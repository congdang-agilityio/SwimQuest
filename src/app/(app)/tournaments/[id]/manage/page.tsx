import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import { TeamList } from "@/components/teams/team-list";
import { InviteLink } from "@/components/tournaments/invite-link";
import styles from "@/components/tournaments/manage.module.css";
import { PublishPanel } from "@/components/tournaments/publish-panel";
import { ButtonLink, Card, Chip, ScreenHeader, type ChipTone } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { getRoute } from "@/lib/routes";
import {
  effectiveStatus,
  isStartLocked,
  startLockAt,
  type TournamentStatus,
} from "@/lib/tournaments/lifecycle";
import { utcToVnParts } from "@/lib/time/vn";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizer } from "@/server/auth/roles";
import { ensureStartsAssigned } from "@/server/jobs/tick";
import { pageOrigin } from "@/server/http/request";
import { listTeamsWithCounts } from "@/server/teams/manage";

const STATUS_TONE: Record<TournamentStatus, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "info",
  ACTIVE: "success",
  COMPLETED: "gold",
  ARCHIVED: "neutral",
};

/** Organizer page: only the organizer sees it; anyone else gets the not-found page (S-04 AC 5). */
export default async function ManageTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const tournament = await requireOrganizer(user.id, id).catch((err: unknown) => {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) notFound();
    throw err;
  });
  const now = new Date();
  await ensureStartsAssigned(tournament.id, now);
  const { teams, capacity } = await listTeamsWithCounts(tournament.id);
  const status = effectiveStatus(tournament, now);
  const destinations = getRoute(tournament.routeId)?.destinations ?? [];
  const rows = teams.map((team) => ({
    ...team,
    startNameKey: destinations.find((d) => d.slug === team.startDestination)?.nameKey ?? null,
    autoAssignedAtIso:
      team.startSetBy === "AUTOMATIC" ? (team.startSetAt?.toISOString() ?? null) : null,
  }));
  const startLock =
    tournament.status === "DRAFT"
      ? undefined
      : {
          locked: isStartLocked(tournament, now),
          lockAtIso: startLockAt(tournament).toISOString(),
        };
  const t = await getTranslations("organizer");
  const tCommon = await getTranslations("common");
  const showInvite = tournament.status !== "DRAFT" && Boolean(tournament.inviteToken);
  const origin = showInvite ? pageOrigin(await headers()) : null;
  const when = (d: Date) => {
    const { date, time } = utcToVnParts(d);
    return `${time} ${date}`;
  };
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader title={tournament.name} backHref="/tournaments" backLabel={tCommon("back")} />
      </div>
      <Card className={styles.overview}>
        {/* The route's sea scene, as on the mockup's tournament cards (G1 art). */}
        <div className={styles.hero}>
          <MockupPicture
            artKey="scenes/sea-ly-son-16x9"
            alt=""
            className={styles.scene}
            eager
            fallback={<div className={styles.sceneFallback} />}
          />
        </div>
        <div className={styles.overviewBody}>
          <p className={styles.statusRow}>
            <span>{t("manage.status")}:</span>
            <Chip tone={STATUS_TONE[status]}>{t(`manage.statusNames.${status}`)}</Chip>
          </p>
          <p id="season" className={styles.meta}>
            <span className={styles.metaLabel}>{t("manage.season")}:</span>{" "}
            {when(tournament.seasonStartAt)} - {when(tournament.seasonEndAt)} (
            {t("manage.vietnamTime")})
          </p>
          <div className={styles.overviewActions}>
            <ButtonLink
              href={`/tournaments/${tournament.id}/manage/settings`}
              variant="secondary"
              block
            >
              {t("manage.settingsLink")}
            </ButtonLink>
          </div>
        </div>
      </Card>
      {tournament.status === "DRAFT" && <PublishPanel tournamentId={tournament.id} />}
      {showInvite && origin && (
        <InviteLink
          url={`${origin}/join/${tournament.inviteToken}`}
          tournamentName={tournament.name}
        />
      )}
      <TeamList
        tournamentId={tournament.id}
        teams={rows}
        capacity={capacity}
        isDraft={tournament.status === "DRAFT"}
        startLock={startLock}
      />
    </main>
  );
}
