import { headers } from "next/headers";
import { getFormatter, getTranslations } from "next-intl/server";
import { JoinGuidance } from "@/components/empty-state/join-guidance";
import { TeamFinish } from "@/components/finish/team-finish";
import { TournamentCard } from "@/components/home/tournament-card";
import { Avatar, ButtonLink, Card } from "@/components/ui";
import { mockupMemberAvatar } from "@/lib/art/mockup-avatars";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { listMyTournaments } from "@/server/home/my-tournaments";
import { getPlayerStats } from "@/server/profile/stats";
import styles from "./home.module.css";

export default async function HomePage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/");
  const [t, format, tournaments, stats] = await Promise.all([
    getTranslations("home"),
    getFormatter(),
    listMyTournaments(user.id, new Date()),
    getPlayerStats(user.id),
  ]);
  const featured = tournaments.find((x) => x.effectiveStatus === "ACTIVE") ?? tournaments[0];
  const km = format.number(stats.verifiedDistanceM / 1000, { maximumFractionDigits: 1 });
  return (
    <main className={styles.home}>
      <Card tone="dark" as="section" className={styles.hero} aria-labelledby="home-title">
        <div className={styles.profile}>
          <Avatar name={user.displayName} src={mockupMemberAvatar(user.id)} size={56} decorative />
          <span className={styles.name}>{user.displayName}</span>
        </div>
        <div className={styles.heroArt}>
          {/* Cut from the mockup's "TRANG CHỦ" hero card (island and lighthouse). */}
          {/* eslint-disable-next-line @next/next/no-img-element -- static art, already sized */}
          <img
            className={styles.scene}
            src="/art/mockup/screen-home/home-hero.png"
            alt=""
            width={330}
            height={114}
          />
          <div className={styles.heroText}>
            <h1 id="home-title" className={styles.brand}>
              SwimQuest
            </h1>
            {featured && <p className={styles.season}>{featured.name}</p>}
          </div>
        </div>
      </Card>

      {/* First open after the team finished: the "Cập bến Lý Sơn" celebration, once per finish. */}
      <div className={styles.finishSlot}>
        <TeamFinish userId={user.id} onlyUnseen />
      </div>

      <Card as="section" className={styles.stats} aria-label={t("stats.label")}>
        <dl className={styles.statList}>
          <div className={styles.stat}>
            <dt>{t("stats.distance")}</dt>
            <dd>
              <span className={styles.statValue}>{km}</span>{" "}
              <span className={styles.statUnit}>{t("stats.km")}</span>
            </dd>
          </div>
          <div className={styles.stat}>
            <dt>{t("stats.badges")}</dt>
            <dd>
              <span className={styles.statValue}>{format.number(stats.badges)}</span>
            </dd>
          </div>
        </dl>
      </Card>

      {tournaments.length === 0 ? (
        <JoinGuidance />
      ) : (
        <>
          <Card
            tone="dark"
            as="section"
            className={styles.tournaments}
            aria-labelledby="home-tournaments"
          >
            <h2 id="home-tournaments" className={styles.sectionTitle}>
              {t("title")}
            </h2>
            <ul className={styles.list}>
              {tournaments.map((x) => (
                <TournamentCard key={x.id} tournament={x} />
              ))}
            </ul>
          </Card>
          <ButtonLink href="/voyage" variant="primary" block>
            {t("voyageMap")}
          </ButtonLink>
        </>
      )}
    </main>
  );
}
