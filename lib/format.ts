const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Formats a "YYYY-MM-DD" string as "2026/08/24(月)" without relying on Intl. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y}/${m}/${d}(${weekdayOf(iso)})`;
}

/** Formats a "YYYY-MM-DD" string as the shorter "08/24(月)", for table columns. */
export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${m}/${d}(${weekdayOf(iso)})`;
}

/** Formats a "YYYY-MM" string as "2026年08月". */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}年${m}月`;
}

/** Formats an integer amount as "¥5,000" without relying on Intl. */
export function formatYen(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const digits = Math.abs(Math.round(amount)).toString();
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}¥${withCommas}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthIso(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Shifts a "YYYY-MM" string by `delta` months (can be negative). */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

const nameCollator = new Intl.Collator("ja");

/** Katakana (U+30A1-U+30F6) shifted to its matching hiragana codepoint. */
function toHiragana(value: string): string {
  return value.replace(/[ァ-ヶ]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

/**
 * Compares two names for ascending sort order, independent of whether either
 * is written in hiragana or katakana (both are normalized to hiragana before
 * comparing) and using Japanese locale collation rather than raw Unicode
 * codepoint order (plain string/SQL comparison sorts by codepoint, which
 * does not follow 五十音 reading order).
 */
export function compareName(a: string, b: string): number {
  return nameCollator.compare(toHiragana(a), toHiragana(b));
}
