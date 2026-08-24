import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import { computeBalance, getFeeSettings, standardFeeAt } from "@/app/lib/balance";
import { deletePayment } from "@/app/lib/actions";

function formatDate(d: Date) {
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "UTC",
  });
}

export default async function MemberDetailPage({
  params,
}: PageProps<"/members/[id]">) {
  const { id } = await params;

  const member = await prisma.member.findUnique({
    where: { id },
    include: { payments: { orderBy: { date: "desc" } } },
  });
  if (!member) notFound();

  const settings = await getFeeSettings();
  const monthlyPayments = member.payments.filter((p) => p.type === "MONTHLY");
  const balance = computeBalance(monthlyPayments, settings);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{member.name}さんのページ</h1>
          <p className="text-sm text-slate-500">
            誰でも閲覧できます。支払い履歴と繰越金・未払金の状況です。
          </p>
        </div>
        <Link href="/members" className="text-sm text-slate-500 hover:underline">
          ← メンバー一覧に戻る
        </Link>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-5">
        {balance < 0 ? (
          <div>
            <p className="text-sm text-slate-500">未払金</p>
            <p className="text-2xl font-bold text-rose-700">
              ¥{Math.abs(balance).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              月謝の合計支払額が標準額に対して不足しています。
            </p>
          </div>
        ) : balance > 0 ? (
          <div>
            <p className="text-sm text-slate-500">繰越金</p>
            <p className="text-2xl font-bold text-sky-700">
              ¥{balance.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              月謝を標準額より多く払っているため、繰り越されています。
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-500">未払金・繰越金</p>
            <p className="text-2xl font-bold text-slate-700">なし（精算済み）</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">支払い履歴</h2>
        {member.payments.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            まだ支払い記録がありません。
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-slate-600">
                  <th className="px-3 py-2 font-medium">日付</th>
                  <th className="px-3 py-2 font-medium">区分</th>
                  <th className="px-3 py-2 font-medium">金額</th>
                  <th className="px-3 py-2 font-medium">標準額との差</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {member.payments.map((p) => {
                  const std =
                    p.type === "MONTHLY" ? standardFeeAt(p.date, settings) : null;
                  const diff = std === null ? null : p.amount - std;
                  return (
                    <tr key={p.id} className="border-t border-slate-200">
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatDate(p.date)}
                      </td>
                      <td className="px-3 py-2">
                        {p.type === "MONTHLY" ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                            月謝
                          </span>
                        ) : (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                            ビジター
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">¥{p.amount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-500">
                        {diff === null ? (
                          "-"
                        ) : diff === 0 ? (
                          "±0"
                        ) : diff > 0 ? (
                          <span className="text-sky-700">+¥{diff.toLocaleString()}</span>
                        ) : (
                          <span className="text-rose-700">-¥{Math.abs(diff).toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <form action={deletePayment}>
                          <input type="hidden" name="paymentId" value={p.id} />
                          <button
                            type="submit"
                            className="text-xs text-slate-400 hover:text-rose-600 hover:underline"
                          >
                            削除
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
