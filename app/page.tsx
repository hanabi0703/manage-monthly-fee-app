import Link from "next/link";
import { prisma } from "@/app/lib/prisma";

function formatDate(d: Date) {
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    timeZone: "UTC",
  });
}

export default async function DashboardPage() {
  const payments = await prisma.payment.findMany({
    include: { member: true },
    orderBy: [{ date: "desc" }],
  });

  const dateKeys = Array.from(
    new Set(payments.map((p) => p.date.toISOString().slice(0, 10))),
  ).sort((a, b) => b.localeCompare(a));

  const members = Array.from(
    new Map(payments.map((p) => [p.member.id, p.member])).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const cellMap = new Map<string, typeof payments>();
  for (const p of payments) {
    const key = `${p.date.toISOString().slice(0, 10)}__${p.memberId}`;
    const list = cellMap.get(key) ?? [];
    list.push(p);
    cellMap.set(key, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">会計表</h1>
          <p className="text-sm text-slate-500">
            日付ごとに、誰が月謝・ビジター料金を払ったか一覧できます。
          </p>
        </div>
        <Link
          href="/entries/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + 入力する
        </Link>
      </div>

      {dateKeys.length === 0 || members.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          まだ記録がありません。「入力する」から登録してください。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-slate-200 bg-slate-100 px-3 py-2 text-left font-medium text-slate-600">
                  日付
                </th>
                {members.map((m) => (
                  <th
                    key={m.id}
                    className="border-b border-l border-slate-200 bg-slate-100 px-3 py-2 text-left font-medium text-slate-600"
                  >
                    <Link href={`/members/${m.id}`} className="hover:underline">
                      {m.name}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dateKeys.map((dateKey) => (
                <tr key={dateKey} className="odd:bg-white even:bg-slate-50/60">
                  <td className="sticky left-0 z-10 whitespace-nowrap border-b border-slate-200 bg-inherit px-3 py-2 font-medium">
                    {formatDate(new Date(dateKey))}
                  </td>
                  {members.map((m) => {
                    const cell = cellMap.get(`${dateKey}__${m.id}`) ?? [];
                    return (
                      <td
                        key={m.id}
                        className="border-b border-l border-slate-200 px-3 py-2 align-top"
                      >
                        {cell.length === 0 ? (
                          <span className="text-slate-300">-</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {cell.map((p) => (
                              <span
                                key={p.id}
                                className={
                                  p.type === "MONTHLY"
                                    ? "inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700"
                                    : "inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-amber-700"
                                }
                              >
                                {p.type === "MONTHLY" ? "✓ 月謝" : "V ビジター"}
                                <span className="text-slate-500">
                                  ¥{p.amount.toLocaleString()}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
