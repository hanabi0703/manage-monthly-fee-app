export type FeeSettingLike = { amount: number; effectiveFrom: string };

/** The standard monthly fee in effect on a given date (YYYY-MM-DD strings). */
export function standardFeeAt(
  date: string,
  settings: FeeSettingLike[],
): number {
  if (settings.length === 0) return 0;
  const sorted = [...settings].sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom),
  );
  let current = sorted[0].amount;
  for (const s of sorted) {
    if (s.effectiveFrom <= date) {
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
 * a carryover credit (繰越金); negative means an unpaid shortfall (未払金).
 */
export function computeBalance(
  monthlyPayments: { date: string; amount: number }[],
  settings: FeeSettingLike[],
): number {
  return monthlyPayments.reduce(
    (sum, p) => sum + (p.amount - standardFeeAt(p.date, settings)),
    0,
  );
}
