import { prisma } from "@/app/lib/prisma";
import { createFeeSetting } from "@/app/lib/actions";

function formatDate(d: Date) {
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  });
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function FeeSettingsPage() {
  const settings = await prisma.feeSetting.findMany({
    orderBy: { effectiveFrom: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">月謝設定</h1>
        <p className="text-sm text-slate-500">
          標準の月謝額と、その適用開始日を管理します。金額が変わる場合はここで新しい行を追加してください。以降、標準額と異なる支払いは各メンバーの繰越金・未払金として自動計算されます。
        </p>
      </div>

      <form
        action={createFeeSetting}
        className="flex flex-wrap items-end gap-4 rounded-md border border-slate-200 bg-white p-5"
      >
        <div className="space-y-1">
          <label htmlFor="amount" className="block text-sm font-medium">
            月謝額
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min={0}
            step={1}
            required
            className="w-40 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="effectiveFrom" className="block text-sm font-medium">
            適用開始日
          </label>
          <input
            id="effectiveFrom"
            name="effectiveFrom"
            type="date"
            required
            defaultValue={todayUtc()}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          追加する
        </button>
      </form>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">設定履歴</h2>
        {settings.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            まだ月謝額が設定されていません。
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
            {settings.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="font-medium">¥{s.amount.toLocaleString()}</span>
                <span className="text-slate-500">
                  {formatDate(s.effectiveFrom)} 〜
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
