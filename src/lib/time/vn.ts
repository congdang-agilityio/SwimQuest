// Vietnam has no DST: a fixed +07:00 offset; never depends on the server time zone.
const OFFSET_MS = 7 * 3600_000;
export type VnParts = { date: string; time: string };
const p = (n: number, w = 2) => String(n).padStart(w, "0");

function checkDate(date: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const [y, mo, d] = m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
  const c = new Date(Date.UTC(y, mo - 1, d));
  if (!m || c.getUTCMonth() !== mo - 1 || c.getUTCDate() !== d)
    throw new Error(`Invalid date: ${date}`);
  return [y, mo, d];
}

/** Vietnam local date (YYYY-MM-DD) and time (HH:mm) to a UTC instant. */
export function vnLocalToUtc(date: string, time: string): Date {
  const [y, mo, d] = checkDate(date);
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m) throw new Error(`Invalid time: ${time}`);
  return new Date(Date.UTC(y, mo - 1, d, +m[1], +m[2]) - OFFSET_MS);
}

/** A UTC instant to its Vietnam local date and time. */
export function utcToVnParts(instant: Date): VnParts {
  if (Number.isNaN(instant.getTime())) throw new Error("Invalid instant");
  const v = new Date(instant.getTime() + OFFSET_MS);
  return {
    date: `${p(v.getUTCFullYear(), 4)}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`,
    time: `${p(v.getUTCHours())}:${p(v.getUTCMinutes())}`,
  };
}

/** Season start 00:00 on the start date, end 23:59 on the end date (Vietnam time). */
export function defaultSeasonTimes(
  startDate: string,
  endDate: string,
): { start: VnParts; end: VnParts } {
  checkDate(startDate);
  checkDate(endDate);
  return { start: { date: startDate, time: "00:00" }, end: { date: endDate, time: "23:59" } };
}

/** The Vietnam calendar day (YYYY-MM-DD) of an instant. */
export const vnDayKey = (instant: Date): string => utcToVnParts(instant).date;

const DAY_MS = 24 * 3600_000;
const dayToMs = (date: string): number => {
  const [y, mo, d] = checkDate(date);
  return Date.UTC(y, mo - 1, d);
};
const msToDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Monday (YYYY-MM-DD, Vietnam time) of the Monday-to-Sunday week containing the instant. */
export function vnWeekStart(instant: Date): string {
  const ms = dayToMs(vnDayKey(instant));
  const sinceMonday = (new Date(ms).getUTCDay() + 6) % 7;
  return msToDay(ms - sinceMonday * DAY_MS);
}

/** UTC instants of a week: Monday 00:00 Vietnam time (inclusive) to next Monday 00:00 (exclusive). */
export function vnWeekRange(weekStart: string): { start: Date; end: Date } {
  if (new Date(dayToMs(weekStart)).getUTCDay() !== 1) throw new Error(`Not a Monday: ${weekStart}`);
  const start = vnLocalToUtc(weekStart, "00:00");
  return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
}

/** The Monday one week before the given Monday. */
export function previousWeekStart(weekStart: string): string {
  vnWeekRange(weekStart);
  return msToDay(dayToMs(weekStart) - 7 * DAY_MS);
}

/** Display form "HH:mm dd/MM/yyyy" of an instant in Vietnam time. */
export function formatVnDateTime(instant: Date): string {
  const { date, time } = utcToVnParts(instant);
  const [y, m, d] = date.split("-");
  return `${time} ${d}/${m}/${y}`;
}
