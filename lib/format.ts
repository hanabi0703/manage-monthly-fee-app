const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** Formats a "YYYY-MM-DD" string as "2026/08/24(月)" without relying on Intl. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}(${weekday})`;
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
