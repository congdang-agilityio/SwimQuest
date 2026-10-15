// Vietnam time helpers. Vietnam has no daylight saving: a fixed +07:00 offset
// is correct and nothing here depends on the server's time zone.

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;

export type VnParts = { date: string; time: string };

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function parseDate(date: string): [number, number, number] {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new Error(`Invalid date: ${date}`);
  }
  return [y, mo, d];
}

function parseTime(time: string): [number, number] {
  const m = TIME_RE.exec(time);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw new Error(`Invalid time: ${time}`);
  return [Number(m[1]), Number(m[2])];
}

/** Vietnam local date (YYYY-MM-DD) and time (HH:mm) to a UTC instant. */
export function vnLocalToUtc(date: string, time: string): Date {
  const [y, mo, d] = parseDate(date);
  const [h, mi] = parseTime(time);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - VN_OFFSET_MS);
}

/** A UTC instant to its Vietnam local date and time. */
export function utcToVnParts(instant: Date): VnParts {
  if (Number.isNaN(instant.getTime())) throw new Error("Invalid instant");
  const v = new Date(instant.getTime() + VN_OFFSET_MS);
  return {
    date: `${pad(v.getUTCFullYear(), 4)}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`,
    time: `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`,
  };
}

/** Default season times: start 00:00 on the start date, end 23:59 on the end date (Vietnam time). */
export function defaultSeasonTimes(
  startDate: string,
  endDate: string,
): { start: VnParts; end: VnParts } {
  parseDate(startDate);
  parseDate(endDate);
  return { start: { date: startDate, time: "00:00" }, end: { date: endDate, time: "23:59" } };
}

/** The Vietnam calendar day (YYYY-MM-DD) of an instant. */
export function vnDayKey(instant: Date): string {
  return utcToVnParts(instant).date;
}
