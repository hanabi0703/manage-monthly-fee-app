/**
 * A member's running balance for monthly fees: paid amount minus the
 * standard fee for the month of each payment's date, summed. Positive
 * means a carryover credit (繰越金); negative means an unpaid shortfall
 * (未払金).
 *
 * `feeForMonth` looks up the standard fee (base amount, or that month's
 * exception amount if one was set) for a "YYYY-MM" string.
 */
export function computeBalance(
  monthlyPayments: { date: string; amount: number }[],
  feeForMonth: (month: string) => number,
): number {
  return monthlyPayments.reduce(
    (sum, p) => sum + (p.amount - feeForMonth(p.date.slice(0, 7))),
    0,
  );
}
