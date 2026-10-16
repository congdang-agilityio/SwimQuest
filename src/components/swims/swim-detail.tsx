import { useLocale, useTranslations } from "next-intl";
import * as f from "@/lib/format/swim";
import { CheckReasons } from "./check-reasons";
import type { MySwimDto } from "@/server/swims/my-swims";

/** A swim with its status, points and reasons in each tournament (no swim-level status). */
export function SwimDetail({ swim }: { swim: MySwimDto }) {
  const t = useTranslations("my-swims.detail");
  const ts = useTranslations("swims.summary");
  const tc = useTranslations("checks");
  const locale = useLocale() === "en" ? "en" : "vi";
  const rows: [string, string][] = [
    [ts("dateTime"), f.formatVnDateTime(swim.date, swim.startTime)],
    [ts("distance"), f.formatDistance(swim.distanceM, locale)],
    [ts("duration"), f.formatDuration(swim.durationS)],
    [ts("pace"), f.formatPace(swim.pacePer100mS)],
    [ts("type"), ts(`types.${swim.swimType}`)],
  ];
  return (
    <>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h2>{tc("title")}</h2>
      {swim.results.length === 0 ? (
        <p>{tc("noTournament")}</p>
      ) : (
        <ul>
          {swim.results.map((r) => (
            <li key={r.tournamentId}>
              <strong>{r.tournamentName}</strong>
              {": "}
              <span>{tc(`status.${r.status}`)}</span>
              <p>{t("points", { points: r.points })}</p>
              <CheckReasons reasons={r.reasons} rules={r.rules} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
