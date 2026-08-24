"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";

function parseDateOnly(value: string): Date {
  // Treat "YYYY-MM-DD" as a UTC calendar date so grouping/formatting stays
  // consistent regardless of server timezone.
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("日付が正しくありません");
  }
  return date;
}

export async function createPayment(formData: FormData) {
  const dateStr = String(formData.get("date") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const amountStr = String(formData.get("amount") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();

  if (!dateStr || !name || !amountStr) {
    throw new Error("日付・名前・金額は必須です");
  }
  if (type !== "MONTHLY" && type !== "VISITOR") {
    throw new Error("区分が不正です");
  }
  const amount = Number(amountStr);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("金額が正しくありません");
  }

  const date = parseDateOnly(dateStr);

  const member = await prisma.member.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  await prisma.payment.create({
    data: {
      date,
      amount,
      type,
      memberId: member.id,
    },
  });

  revalidatePath("/");
  revalidatePath("/members", "layout");
  redirect("/");
}

export async function deletePayment(formData: FormData) {
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) {
    throw new Error("削除対象が指定されていません");
  }

  await prisma.payment.delete({
    where: { id: paymentId },
  });

  revalidatePath("/");
  revalidatePath("/members", "layout");
}

export async function createFeeSetting(formData: FormData) {
  const amountStr = String(formData.get("amount") ?? "").trim();
  const dateStr = String(formData.get("effectiveFrom") ?? "").trim();

  if (!amountStr || !dateStr) {
    throw new Error("金額・適用開始日は必須です");
  }
  const amount = Number(amountStr);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("金額が正しくありません");
  }

  await prisma.feeSetting.create({
    data: {
      amount,
      effectiveFrom: parseDateOnly(dateStr),
    },
  });

  revalidatePath("/settings/fee");
  revalidatePath("/members", "layout");
  redirect("/settings/fee");
}
