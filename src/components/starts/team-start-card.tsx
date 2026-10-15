import { useTranslations } from "next-intl";
import { formatVnDateTime } from "@/lib/time/vn";

const link = { display: "inline-flex", alignItems: "center", minHeight: 44, minWidth: 44 } as const;

/** "Assigned automatically" with the assignment time (Vietnam time); reused by the Voyage page. */
export function StartOriginLabel({ setAtIso }: { setAtIso: string }) {
  const t = useTranslations();
  return (
    <span>{t("starts.origin.automaticAt", { setAt: formatVnDateTime(new Date(setAtIso)) })}</span>
  );
}

type Props = {
  /** Message key of the team's start name (`routes` namespace), or null when none is chosen. */
  startNameKey: string | null;
  isCaptain: boolean;
  /** ISO instant of the start lock (start-choice deadline). */
  lockAtIso: string;
  locked: boolean;
  /** ISO instant the start was assigned automatically; null/omitted when a person chose it. */
  autoAssignedAtIso?: string | null;
};

/** The team's start on My Team; the captain gets a way in until the lock (FR-38). */
export function TeamStartCard({
  startNameKey,
  isCaptain,
  lockAtIso,
  locked,
  autoAssignedAtIso,
}: Props) {
  const t = useTranslations();
  const canChoose = isCaptain && !locked;
  return (
    <section aria-labelledby="team-start-title">
      <h2 id="team-start-title">{t("starts.card.title")}</h2>
      <p>{startNameKey ? t(startNameKey) : t("starts.card.notChosen")}</p>
      {startNameKey && autoAssignedAtIso && (
        <p>
          <StartOriginLabel setAtIso={autoAssignedAtIso} />
        </p>
      )}
      {locked && (
        <p>{t("starts.card.lockedSince", { lockedAt: formatVnDateTime(new Date(lockAtIso)) })}</p>
      )}
      {canChoose && (
        <>
          <p>{t("starts.card.deadline", { deadline: formatVnDateTime(new Date(lockAtIso)) })}</p>
          {!startNameKey && <p>{t("starts.card.auto")}</p>}
          <a href="/team/start" style={link}>
            {startNameKey ? t("starts.card.change") : t("starts.card.choose")}
          </a>
        </>
      )}
    </section>
  );
}
