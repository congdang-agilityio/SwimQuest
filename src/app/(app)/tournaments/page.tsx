import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import styles from "@/components/tournaments/tournament-list.module.css";
import { TournamentList } from "@/components/tournaments/tournament-list";
import { ButtonLink, Card, SectionHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { listMyTournaments } from "@/server/home/my-tournaments";

/** My tournaments ("DANH SÁCH GIẢI ĐẤU" panel): filter pills and card rows. */
export default async function TournamentsPage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const [t, tournaments] = await Promise.all([
    getTranslations("tabs.tournaments"),
    listMyTournaments(user.id, new Date()),
  ]);
  return (
    <main className={styles.screen}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("title")}</h1>
        <ButtonLink href="/tournaments/new" size="sm">
          {t("create")}
        </ButtonLink>
      </div>
      <section className={styles.panel} aria-labelledby="tournament-list-title">
        <div className={styles.panelHeader}>
          <SectionHeader id="tournament-list-title">{t("listTitle")}</SectionHeader>
        </div>
        <Card className={styles.card}>
          {tournaments.length === 0 ? (
            <p className={styles.empty}>{t("empty")}</p>
          ) : (
            <TournamentList tournaments={tournaments} />
          )}
        </Card>
      </section>
    </main>
  );
}
