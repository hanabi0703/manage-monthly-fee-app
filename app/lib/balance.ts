import { prisma } from "@/app/lib/prisma";

export type FeeSetting = { amount: number; effectiveFrom: Date };

/** The standard monthly fee in effect on a given date. */
export function standardFeeAt(date: Date, settings: FeeSetting[]): number {
  if (settings.length === 0) return 0;
  const sorted = [...settings].sort(
    (a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime(),
  );
  let current = sorted[0].amount;
  for (const s of sorted) {
    if (s.effectiveFrom.getTime() <= date.getTime()) {
      current = s.amount;
    } else {
      break;
    }
  }
  return current;
}

/**
 * A member's running balance for monthly fees: paid amount minus the
 * standard fee in effect on each payment's date, summed. Positive means
 * the member has a carryover credit (繰越金); negative means an unpaid
 * shortfall (未払金).
 */
export function computeBalance(
  monthlyPayments: { date: Date; amount: number }[],
  settings: FeeSetting[],
): number {
  return monthlyPayments.reduce(
    (sum, p) => sum + (p.amount - standardFeeAt(p.date, settings)),
    0,
  );
}

export async function getFeeSettings(): Promise<FeeSetting[]> {
  return prisma.feeSetting.findMany({
    orderBy: { effectiveFrom: "asc" },
    select: { amount: true, effectiveFrom: true },
  });
}

export async function getCurrentFee(): Promise<number> {
  const settings = await getFeeSettings();
  return standardFeeAt(new Date(), settings);
}
