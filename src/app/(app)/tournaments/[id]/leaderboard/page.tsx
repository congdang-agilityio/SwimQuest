import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import styles from "@/components/leaderboard/leaderboard.module.css";
import { ProgressTable } from "@/components/leaderboard/progress-table";
import { Card, ScreenHeader, SectionHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import {
  LeaderboardError,
  getProgressLeaderboard,
} from "@/server/leaderboard/progress-leaderboard";

export const dynamic = "force-dynamic";

/** Tournament leaderboard, opening on the Progress tab; non-members get the not-found page. */
export default async function LeaderboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(
    (await headers()).get(NEXT_PATH_HEADER) ?? `/tournaments/${id}/leaderboard`,
  );
  const rows = await getProgressLeaderboard(user.id, id).catch((err: unknown) => {
    if (err instanceof LeaderboardError) notFound();
    throw err;
  });
  const t = await getTranslations("leaderboard");
  const tCommon = await getTranslations("common");
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/voyage" backLabel={tCommon("back")} />
      </div>
      <section className={styles.panel} aria-labelledby="leaderboard-panel-title">
        <div className={styles.panelHeader}>
          <SectionHeader id="leaderboard-panel-title">{t("panelTitle")}</SectionHeader>
        </div>
        <Card className={styles.card}>
          {/* Only the Progress tab exists for now; more tabs join this list later (S-22). */}
          <div role="tablist" aria-label={t("tabs")} className={styles.tablist}>
            <span
              role="tab"
              aria-selected="true"
              aria-controls="progress-panel"
              id="progress-tab"
              className={styles.tab}
            >
              {t("progressTab")}
            </span>
          </div>
          <div role="tabpanel" id="progress-panel" aria-labelledby="progress-tab">
            <p className={styles.intro}>{t("progressHeader")}</p>
            <ProgressTable rows={rows} />
          </div>
        </Card>
      </section>
    </main>
  );
}
