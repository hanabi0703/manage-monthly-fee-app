/**
 * A member's running balance for monthly fees: paid amount minus the
 * standard fee for the month of each payment's date, summed. Positive
 * means a carryover credit (繰越金); negative means an unpaid shortfall
 * (未払金).
 *
 * `feeForMonth` looks up the standard fee (base amount, or that month's
 * exception amount if one was set) for a "YYYY-MM" string.
 *
 * A payment with no date (不足金支払い / shortfall payment, which isn't
 * tied to any specific practice day) is added to the balance in full,
 * with no fee subtracted, since it exists purely to pay down whatever
 * shortfall already exists rather than to settle one month's fee.
 */
export function computeBalance(
  monthlyPayments: { date: string; amount: number }[],
  feeForMonth: (month: string) => number,
): number {
  return monthlyPayments.reduce((sum, p) => {
    if (!p.date) return sum + p.amount;
    return sum + (p.amount - feeForMonth(p.date.slice(0, 7)));
  }, 0);
}

/**
 * Drops cancelled payments and their 取消(cancellation) records from a list,
 * so balance/unpaid calculations treat a cancelled-and-cancelling pair as if
 * neither had happened — matching `cancelPayment`, which keeps both rows in
 * the raw history rather than deleting the original. Use this on any list
 * feeding `computeBalance` or an unpaid check; use the raw list as returned
 * by `listPayments`/`listPaymentsForMember` for history display.
 */
export function excludeCancelledPayments<T extends { id: string; cancelsPaymentId: string | null }>(
  payments: T[],
): T[] {
  const cancelledIds = new Set(
    payments.filter((p) => p.cancelsPaymentId).map((p) => p.cancelsPaymentId as string),
  );
  return payments.filter((p) => !p.cancelsPaymentId && !cancelledIds.has(p.id));
}
