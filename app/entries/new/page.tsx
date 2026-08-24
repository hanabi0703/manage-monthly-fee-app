import { prisma } from "@/app/lib/prisma";
import { getCurrentFee } from "@/app/lib/balance";
import { createPayment } from "@/app/lib/actions";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewEntryPage() {
  const [members, currentFee] = await Promise.all([
    prisma.member.findMany({ orderBy: { name: "asc" } }),
    getCurrentFee(),
  ]);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-bold">支払いを記録</h1>
        <p className="text-sm text-slate-500">
          現在の月謝額: ¥{currentFee.toLocaleString()}
        </p>
      </div>

      <form
        action={createPayment}
        className="space-y-4 rounded-md border border-slate-200 bg-white p-5"
      >
        <div className="space-y-1">
          <label htmlFor="date" className="block text-sm font-medium">
            日付
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={todayUtc()}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="name" className="block text-sm font-medium">
            メンバーの名前
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            list="member-names"
            placeholder="例: 山田太郎"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <datalist id="member-names">
            {members.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
          <p className="text-xs text-slate-400">
            新しい名前を入力すると自動的にメンバーが追加されます。
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="amount" className="block text-sm font-medium">
            もらった金額
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={currentFee || undefined}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <fieldset className="space-y-1">
          <legend className="block text-sm font-medium">区分</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="type"
                value="MONTHLY"
                defaultChecked
                className="accent-slate-900"
              />
              月謝
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="type"
                value="VISITOR"
                className="accent-slate-900"
              />
              ビジター
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          登録する
        </button>
      </form>
    </div>
  );
}
