import Link from "next/link";
import { useTranslations } from "next-intl";
import { MockupPicture } from "@/components/art/mockup-picture";
import styles from "./console.module.css";
import { Chip, SectionHeader } from "@/components/ui";
import { landmarkKey } from "@/lib/art/mockup-art";
import { formatVnDateTime } from "@/lib/time/vn";
import type { ConsoleTeamStart } from "@/server/organizer/console";

type Props = {
  tournamentId: string;
  starts: readonly ConsoleTeamStart[];
  locked: boolean;
  /** The start-choice lock; null for a draft. */
  lockAt: Date | null;
  /** Message key of each destination name, by slug (`routes.<route>.<slug>`). */
  nameKeys: Readonly<Record<string, string>>;
};

/** "Starts" of the organizer console (S-65 AC 4): each team's start, origin and the lock. */
export function StartsSection({ tournamentId, starts, locked, lockAt, nameKeys }: Props) {
  const t = useTranslations();
  const c = (key: string, values?: Record<string, string>) =>
    t(`organizer.console.starts.${key}`, values);
  const placeholder = <span className={styles.landmarkFallback} aria-hidden="true" />;
  return (
    <section aria-labelledby="console-starts" className={styles.section}>
      <SectionHeader id="console-starts">{c("title")}</SectionHeader>
      <div className={styles.sectionBody}>
        {lockAt && (
          <p className={styles.lockRow}>
            <Chip tone={locked ? "warning" : "info"}>{locked ? c("locked") : c("open")}</Chip>
            <span>{c(locked ? "lockedAt" : "openUntil", { at: formatVnDateTime(lockAt) })}</span>
          </p>
        )}
        {starts.length === 0 && <p className={styles.empty}>{c("empty")}</p>}
        <ul className={styles.list}>
          {starts.map((s) => {
            const art = s.slug ? landmarkKey(s.slug) : undefined;
            const nameKey = s.slug ? nameKeys[s.slug] : undefined;
            return (
              <li
                key={s.teamId}
                className={styles.startRow}
                data-has-start={s.slug ? "true" : "false"}
              >
                {art ? (
                  <MockupPicture
                    artKey={art}
                    alt=""
                    className={styles.landmark}
                    fallback={placeholder}
                  />
                ) : (
                  placeholder
                )}
                <span className={styles.startInfo}>
                  <Link
                    href={`/tournaments/${tournamentId}/manage/teams/${s.teamId}`}
                    className={styles.teamName}
                  >
                    {s.teamName}
                  </Link>
                  <span className={styles.startName}>{nameKey ? t(nameKey) : c("none")}</span>
                  {!s.slug && (
                    <span className={styles.startHint}>
                      {s.dueForAutomatic || !s.automaticAssignmentAt
                        ? c(s.dueForAutomatic ? "due" : "draftHint")
                        : c("autoAt", { at: formatVnDateTime(s.automaticAssignmentAt) })}
                    </span>
                  )}
                </span>
                {s.slug && s.setBy && (
                  <Chip tone={s.setBy === "AUTOMATIC" ? "gold" : "neutral"}>
                    {c(`setBy.${s.setBy}`)}
                  </Chip>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
