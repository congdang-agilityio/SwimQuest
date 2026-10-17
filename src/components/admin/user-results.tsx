import { getFormatter, getTranslations } from "next-intl/server";
import { RevokeDialog } from "@/components/review/revoke-dialog";
import { Chip, SectionHeader, type ChipTone } from "@/components/ui";
import type { AdminUserResultDto } from "@/server/admin/users";
import styles from "./admin.module.css";

const tone = (status: AdminUserResultDto["status"]): ChipTone =>
  status === "VERIFIED" ? "success" : status === "REVOKED" ? "danger" : "warning";

/**
 * The user's swim results in every tournament on the admin user page (S-72 AC 4). A verified
 * result of a tournament that is not archived can be revoked with a reason, reversed exactly as
 * the reviewer path (S-46).
 */
export async function UserResults({
  results,
  displayName,
}: {
  results: readonly AdminUserResultDto[];
  displayName: string;
}) {
  const t = await getTranslations("admin.user.results");
  const tStatus = await getTranslations("review.status");
  const format = await getFormatter();
  return (
    <section aria-labelledby="results-title" className={styles.panel}>
      <SectionHeader id="results-title">{t("title")}</SectionHeader>
      <div className={styles.panelBody}>
        <p className={styles.muted}>{t("help")}</p>
        {results.length === 0 ? (
          <p className={styles.muted}>{t("empty")}</p>
        ) : (
          <ul className={styles.list}>
            {results.map((r) => (
              <li key={r.id} className={styles.resultRow}>
                <span className={styles.rowText}>
                  <span className={styles.name}>{r.tournament.name}</span>
                  <span className={styles.email}>
                    {t("line", {
                      team: r.teamName,
                      date: format.dateTime(new Date(r.startedAt), { dateStyle: "medium" }),
                      km: format.number(r.distanceM / 1000, { maximumFractionDigits: 2 }),
                    })}
                  </span>
                </span>
                <span className={styles.chips}>
                  <Chip tone={tone(r.status)}>{tStatus(r.status)}</Chip>
                  {r.tournament.archived && <Chip>{t("archived")}</Chip>}
                </span>
                {r.status === "VERIFIED" && !r.tournament.archived && (
                  <RevokeDialog
                    resultId={r.id}
                    playerName={displayName}
                    endpoint={`/api/admin/results/${encodeURIComponent(r.id)}/revoke`}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
