/**
 * Accepts a decimal comma as well as a dot in a typed number ("7,5" or "7.5"). Only a single
 * comma between digits is rewritten; anything else is returned unchanged for the caller's own
 * validation, which stays the source of truth.
 */
export function normalizeDecimal<T>(value: T): T | string {
  if (typeof value !== "string") return value;
  const s = value.trim();
  return /^[+-]?\d+,\d+$/.test(s) ? s.replace(",", ".") : value;
}

/** Whole metres as kilometres text in the locale's decimal separator (7500 -> "7,5" in vi). */
export function formatKm(metres: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 3, useGrouping: false }).format(
    metres / 1000,
  );
}
