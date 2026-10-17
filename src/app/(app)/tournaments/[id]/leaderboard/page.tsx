import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import styles from "@/components/leaderboard/leaderboard.module.css";
import { LeaderboardTabs } from "@/components/leaderboard/leaderboard-tabs";
import { ProgressTable } from "@/components/leaderboard/progress-table";
import { ValueTable } from "@/components/leaderboard/value-table";
import { Card, Chip, ScreenHeader, SectionHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { effectiveStatus, isResultsFinal, uploadWindowEndsAt } from "@/lib/tournaments/lifecycle";
import { formatVnDateTime } from "@/lib/time/vn";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/current-user";
import { getBadgesLeaderboard } from "@/server/leaderboard/badges-leaderboard";
import { getKmLeaderboard, getPointsLeaderboard } from "@/server/leaderboard/points-leaderboard";
import {
  LeaderboardError,
  getProgressLeaderboard,
} from "@/server/leaderboard/progress-leaderboard";

export const dynamic = "force-dynamic";

/** Tournament leaderboard, opening on the Progress tab; non-members get the not-found page. */
const TABS = ["progress", "points", "km", "badges"] as const;
type Tab = (typeof TABS)[number];

/** Tournament leaderboard, opening on the Progress tab (`?tab=`); non-members get the not-found page. */
export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.find((x) => x === rawTab) ?? "progress";
  const user = await requireUser(
    (await headers()).get(NEXT_PATH_HEADER) ?? `/tournaments/${id}/leaderboard`,
  );
  const t = await getTranslations("leaderboard");
  const tCommon = await getTranslations("common");
  const guard = (err: unknown): never => {
    if (err instanceof LeaderboardError) notFound();
    throw err;
  };
  let content: ReactNode;
  if (tab === "points") {
    const rows = await getPointsLeaderboard(user.id, id).catch(guard);
    content = (
      <ValueTable
        caption={t("pointsCaption")}
        valueHeader={t("points")}
        rows={rows.map((r) => ({ ...r, value: t("pointsValue", { count: r.points }) }))}
      />
    );
  } else if (tab === "km") {
    const rows = await getKmLeaderboard(user.id, id).catch(guard);
    content = (
      <ValueTable
        caption={t("kmCaption")}
        valueHeader={t("totalKm")}
        rows={rows.map((r) => ({
          ...r,
          value: t("kmValue", { km: Math.round(r.countedM / 100) / 10 }),
        }))}
      />
    );
  } else if (tab === "badges") {
    const rows = await getBadgesLeaderboard(user.id, id).catch(guard);
    content = (
      <ValueTable
        caption={t("badgesCaption")}
        valueHeader={t("badges")}
        rows={rows.map((r) => ({ ...r, value: t("badgesValue", { count: r.badges }) }))}
      />
    );
  } else {
    content = <ProgressTable rows={await getProgressLeaderboard(user.id, id).catch(guard)} />;
  }
  // Final once archived or the late-upload window has passed; until then the end of that window.
  const tournament = await db.tournament.findUnique({
    where: { id },
    select: {
      status: true,
      seasonStartAt: true,
      seasonEndAt: true,
      startChoiceDeadlineAt: true,
      lateUploadDays: true,
    },
  });
  const now = new Date();
  const completed = tournament !== null && effectiveStatus(tournament, now) === "COMPLETED";
  const final =
    tournament !== null &&
    (tournament.status === "ARCHIVED" || (completed && isResultsFinal(tournament, now)));
  const tLifecycle = await getTranslations("lifecycle");
  const tabs = TABS.map((x) => ({
    id: x,
    label: t(`${x}Tab`),
    href:
      x === "progress"
        ? `/tournaments/${id}/leaderboard`
        : `/tournaments/${id}/leaderboard?tab=${x}`,
  }));
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
          <LeaderboardTabs tabs={tabs} active={tab} label={t("tabs")} />
          <div role="tabpanel" id={`${tab}-panel`} aria-labelledby={`${tab}-tab`}>
            {tournament && (final || completed) && (
              <p className={styles.finality}>
                {final ? (
                  <Chip tone="gold">{tLifecycle("results.final")}</Chip>
                ) : (
                  tLifecycle("results.mayChange", {
                    when: formatVnDateTime(uploadWindowEndsAt(tournament)),
                  })
                )}
              </p>
            )}
            <p className={styles.intro}>{t(`${tab}Header`)}</p>
            {content}
          </div>
        </Card>
      </section>
    </main>
  );
}
