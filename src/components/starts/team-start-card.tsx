import { useTranslations } from "next-intl";
import { formatVnDateTime } from "@/lib/time/vn";

const link = { display: "inline-flex", alignItems: "center", minHeight: 44, minWidth: 44 } as const;

type Props = {
  /** Slug of the team's start, or null when none is chosen. */
  startSlug: string | null;
  isCaptain: boolean;
  /** ISO instant of the start lock (start-choice deadline). */
  lockAtIso: string;
  locked: boolean;
};

/** The team's start on My Team; the captain gets a way in until the lock (FR-38). */
export function TeamStartCard({ startSlug, isCaptain, lockAtIso, locked }: Props) {
  const t = useTranslations("starts");
  const canChoose = isCaptain && !locked;
  return (
    <section aria-labelledby="team-start-title">
      <h2 id="team-start-title">{t("card.title")}</h2>
      <p>{startSlug ? t(`names.${startSlug}`) : t("card.notChosen")}</p>
      {canChoose && (
        <>
          <p>{t("card.deadline", { deadline: formatVnDateTime(new Date(lockAtIso)) })}</p>
          {!startSlug && <p>{t("card.auto")}</p>}
          <a href="/team/start" style={link}>
            {startSlug ? t("card.change") : t("card.choose")}
          </a>
        </>
      )}
    </section>
  );
}
