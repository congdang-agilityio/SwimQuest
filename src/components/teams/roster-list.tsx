import { useTranslations } from "next-intl";
import { MakeCaptainButton } from "./make-captain-button";

export type RosterRow = { id: string; displayName: string; isCaptain: boolean };

/** Organizer roster: display names, a captain mark (icon + text) and Make captain on the rest. */
export function RosterList({ teamId, members }: { teamId: string; members: readonly RosterRow[] }) {
  const t = useTranslations("captain");
  return (
    <section aria-labelledby="roster-title">
      <h2 id="roster-title">{t("rosterTitle")}</h2>
      {members.length === 0 && <p>{t("empty")}</p>}
      <ul>
        {members.map((m) => (
          <li key={m.id}>
            <span>{m.displayName}</span>{" "}
            {m.isCaptain ? (
              <strong>
                <span aria-hidden="true">★</span> {t("captain")}
              </strong>
            ) : (
              <MakeCaptainButton teamId={teamId} userId={m.id} name={m.displayName} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
