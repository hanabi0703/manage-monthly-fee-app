import Link from "next/link";
import { prisma } from "@/app/lib/prisma";
import { computeBalance, getFeeSettings } from "@/app/lib/balance";

export default async function MembersPage() {
  const [members, settings] = await Promise.all([
    prisma.member.findMany({
      orderBy: { name: "asc" },
      include: { payments: { where: { type: "MONTHLY" } } },
    }),
    getFeeSettings(),
  ]);

  const rows = members.map((m) => ({
    id: m.id,
    name: m.name,
    balance: computeBalance(m.payments, settings),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">メンバー一覧</h1>
        <p className="text-sm text-slate-500">
          誰でも閲覧できます。繰越金・未払金の状況を確認できます。
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          まだメンバーが登録されていません。
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/members/${r.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
              >
                <span className="font-medium">{r.name}</span>
                {r.balance < 0 ? (
                  <span className="rounded bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700">
                    未払金 ¥{Math.abs(r.balance).toLocaleString()}
                  </span>
                ) : r.balance > 0 ? (
                  <span className="rounded bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                    繰越金 ¥{r.balance.toLocaleString()}
                  </span>
                ) : (
                  <span className="rounded bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                    精算済み
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
