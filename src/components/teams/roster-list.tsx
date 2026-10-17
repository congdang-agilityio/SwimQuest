import { useTranslations } from "next-intl";
import { MakeCaptainButton } from "./make-captain-button";
import { RemoveMemberButton } from "./remove-member-button";
import { MoveMemberDialog, type MoveTarget } from "./move-member-dialog";

export type RosterRow = { id: string; displayName: string; isCaptain: boolean };

/** Organizer roster: display names, a captain mark (icon + text) and Make captain on the rest. */
export function RosterList({
  teamId,
  members,
  moveTargets,
  afterStart = false,
}: {
  teamId: string;
  members: readonly RosterRow[];
  /** Other teams of the tournament with their free places; omit to hide Move. */
  moveTargets?: readonly MoveTarget[];
  /** The tournament has started: Remove then warns that the swims stay with the team. */
  afterStart?: boolean;
}) {
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
            <RemoveMemberButton
              teamId={teamId}
              userId={m.id}
              name={m.displayName}
              afterStart={afterStart}
            />
            {moveTargets && (
              <MoveMemberDialog
                teamId={teamId}
                userId={m.id}
                name={m.displayName}
                targets={moveTargets}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
