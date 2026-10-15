import { useTranslations } from "next-intl";
import { formatVnDateTime } from "@/lib/time/vn";

type Props = {
  /** Message key of the chosen start (`routes.<route>.<slug>`), or null when not chosen yet. */
  startNameKey: string | null;
  locked: boolean;
  /** When the start choice locks (ISO instant). */
  lockAtIso: string;
};

/** Organizer view of one team's start and whether it is locked (FR-26). */
export function TeamStartStatus({ startNameKey, locked, lockAtIso }: Props) {
  const t = useTranslations();
  return (
    <span>
      {startNameKey ? t("teams.start.name", { name: t(startNameKey) }) : t("teams.start.notChosen")}
      {locked && (
        <>
          {" "}
          <strong>
            {t("teams.start.locked", { lockedAt: formatVnDateTime(new Date(lockAtIso)) })}
          </strong>
        </>
      )}
    </span>
  );
}
