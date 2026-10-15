import { useLocale, useTranslations } from "next-intl";
import * as f from "@/lib/format/swim";
import { utcToVnParts } from "@/lib/time/vn";
import type { ResultRulesDto } from "@/server/swims/swim-dto";

/** "dd/mm HH:mm" in Vietnam time. */
function vnShort(iso: string): string {
  const { date, time } = utcToVnParts(new Date(iso));
  const [, m, d] = date.split("-");
  return `${d}/${m} ${time}`;
}

/** The failed checks of one result, each in plain words with the tournament's limit. */
export function CheckReasons({ reasons, rules }: { reasons: string[]; rules: ResultRulesDto }) {
  const t = useTranslations("checks.reasons");
  const locale = useLocale() === "en" ? "en" : "vi";
  if (reasons.length === 0) return null;
  const values = {
    start: vnShort(rules.seasonStartAt),
    end: vnShort(rules.seasonEndAt),
    pace: "",
    distance: f.formatDistance(rules.longestSwimM, locale),
  };
  const text = (code: string) => {
    if (!t.has(code)) return null;
    const pace = code === "PACE_TOO_SLOW" ? rules.slowestPaceS : rules.fastestPaceS;
    return t(code, { ...values, pace: f.formatDuration(pace) });
  };
  return (
    <ul>
      {reasons.map((code) => {
        const line = text(code);
        return line ? <li key={code}>{line}</li> : null;
      })}
    </ul>
  );
}
