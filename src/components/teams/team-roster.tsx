import { useTranslations } from "next-intl";
import type { MyTeamMember } from "@/server/teams/my-team-view";

/** Every member with verified km and points; the captain is marked by icon plus text. */
export function TeamRoster({ members }: { members: readonly MyTeamMember[] }) {
  const t = useTranslations("team");
  return (
    <section aria-labelledby="team-roster-title">
      <h2 id="team-roster-title">{t("rosterTitle")}</h2>
      <ul>
        {members.map((m) => (
          <li key={m.id}>
            <span>{m.displayName}</span>{" "}
            {m.isCaptain && (
              <strong>
                <span aria-hidden="true">★</span> {t("captain")}
              </strong>
            )}{" "}
            <span>{t("km", { km: Math.round(m.verifiedKm * 100) / 100 })}</span>{" "}
            <span>{t("points", { points: m.points })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
