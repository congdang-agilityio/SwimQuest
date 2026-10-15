import { useLocale, useTranslations } from "next-intl";
import * as f from "@/lib/format/swim";
import { CheckReasons } from "./check-reasons";
import type { OwnerSwimDto } from "@/server/swims/swim-dto";

const ICONS: Record<string, string> = { VERIFIED: "✓", FLAGGED: "⚠", DUPLICATE: "⧉" };

export function SwimSummary({ swim }: { swim: OwnerSwimDto }) {
  const t = useTranslations("swims.summary");
  const tc = useTranslations("checks");
  const locale = useLocale() === "en" ? "en" : "vi";
  const rows: [string, string][] = [
    [t("dateTime"), f.formatVnDateTime(swim.date, swim.startTime)],
    [t("distance"), f.formatDistance(swim.distanceM, locale)],
    [t("duration"), f.formatDuration(swim.durationS)],
    [t("pace"), f.formatPace(swim.pacePer100mS)],
    [t("type"), t(`types.${swim.swimType}`)],
    [t("status"), t(`statuses.${f.swimStatus(swim)}`)],
  ];
  return (
    <section aria-labelledby="swim-summary-title">
      <h2 id="swim-summary-title">{t("title")}</h2>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h3>{tc("title")}</h3>
      {swim.results.length === 0 ? (
        <p>{tc("noTournament")}</p>
      ) : (
        <ul>
          {swim.results.map((r) => (
            <li key={r.tournamentId}>
              <strong>{r.tournamentName}</strong>
              {": "}
              <span>
                <span aria-hidden="true">{ICONS[r.status] ?? "•"} </span>
                {tc(`status.${r.status}`)}
              </span>
              <CheckReasons reasons={r.reasons} rules={r.rules} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
