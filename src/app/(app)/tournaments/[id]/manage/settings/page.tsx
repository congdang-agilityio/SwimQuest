import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DeadlineSettingsForm } from "@/components/settings/deadline-settings-form";
import { ExtraRulesForm } from "@/components/settings/extra-rules-form";
import { RealisticLimitsForm } from "@/components/settings/realistic-limits-form";
import {
  OptionalFieldsForm,
  type OptionalValues,
} from "@/components/settings/optional-fields-form";
import { PointValuesForm } from "@/components/settings/point-values-form";
import styles from "@/components/settings/settings-card.module.css";
import { VisibilityField } from "@/components/settings/visibility-field";
import { SwimSettingsForm } from "@/components/settings/swim-settings-form";
import type { PointValues } from "@/components/tournaments/rules/point-rules";
import type { SwimRulesValues } from "@/components/tournaments/rules/swim-rules";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { ButtonLink, Card, ScreenHeader } from "@/components/ui";
import { SWIM_LIMIT_BOUNDS, type SwimLimitField } from "@/lib/swim-limits";
import { effectiveStatus } from "@/lib/tournaments/lifecycle";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizer } from "@/server/auth/roles";
import { boundOf } from "@/lib/validation/settings/realistic-limits";
import { getSettings } from "@/server/tournaments/update-settings";

/** "Rules and settings": organizer only; anyone else gets the not-found page. */
export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const tournament = await requireOrganizer(user.id, id).catch((err: unknown) => {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) notFound();
    throw err;
  });
  const settings = await getSettings(tournament.id);
  const swim = settings?.swim as SwimRulesValues | undefined;
  const deadlines = settings?.deadlines as
    | { submissionDays: number; lateUploadDays: number; startChoiceDeadlineAt: Date | null }
    | undefined;
  const extra = settings?.extraRules as
    { minSwimDistanceM: number | null; extraSlowestPaceSecPer100m: number | null } | undefined;
  const visibility = (
    settings?.visibility as { visibility: "PUBLIC" | "INVITE_ONLY" | null } | undefined
  )?.visibility;
  const points = settings?.points as PointValues | undefined;
  const limits = settings?.realisticLimits as
    | {
        fastestPaceSecPer100m: number;
        slowestPaceSecPer100m: number;
        longestRealisticSwimM: number;
      }
    | undefined;
  const optional = settings?.optional as OptionalValues | undefined;
  if (!swim || !deadlines) notFound();
  const status = effectiveStatus(tournament, new Date());
  const locked = status !== "DRAFT" && status !== "PUBLISHED";
  const bounds = Object.fromEntries(
    (Object.keys(SWIM_LIMIT_BOUNDS) as SwimLimitField[]).map((f) => [
      f,
      boundOf(tournament.swimLimitBounds, f),
    ]),
  ) as Record<SwimLimitField, { min: number; max: number }>;
  const t = await getTranslations("settings");
  const tCommon = await getTranslations("common");
  const tZalo = await getTranslations("zalo");
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader
          title={t("page.title")}
          backHref={`/tournaments/${tournament.id}/manage`}
          backLabel={tCommon("back")}
        />
      </div>
      <Card as="section" id="visibility" className={styles.card}>
        <VisibilityField tournamentId={tournament.id} value={visibility ?? null} />
      </Card>
      <Card as="section" className={styles.card}>
        <SwimSettingsForm tournamentId={tournament.id} values={swim} locked={locked} />
      </Card>
      <Card as="section" className={styles.card}>
        <DeadlineSettingsForm
          tournamentId={tournament.id}
          values={{
            submissionDays: deadlines.submissionDays,
            lateUploadDays: deadlines.lateUploadDays,
            startChoiceDeadlineAt: deadlines.startChoiceDeadlineAt?.toISOString() ?? null,
            seasonStartAt: tournament.seasonStartAt.toISOString(),
          }}
          locked={locked}
        />
      </Card>
      {limits && (
        <Card as="section" className={styles.card}>
          <RealisticLimitsForm
            tournamentId={tournament.id}
            values={limits}
            bounds={bounds}
            locked={locked}
          />
        </Card>
      )}
      {points && (
        <Card as="section" className={styles.card}>
          <PointValuesForm
            tournamentId={tournament.id}
            values={points}
            routeDistanceM={tournament.routeDistanceM}
            locked={locked}
          />
        </Card>
      )}
      {extra && (
        <Card as="section" className={styles.card}>
          <ExtraRulesForm
            tournamentId={tournament.id}
            values={extra}
            slowestPaceSecPer100m={tournament.slowestPaceSecPer100m}
            locked={locked}
          />
        </Card>
      )}
      {optional && (
        <Card as="section" id="optional" className={styles.card}>
          <OptionalFieldsForm tournamentId={tournament.id} values={optional} />
        </Card>
      )}
      <Card as="section" id="zalo" aria-labelledby="zalo-settings-title" className={styles.card}>
        <h2 id="zalo-settings-title" className={styles.heading}>
          {tZalo("title")}
        </h2>
        <p className={styles.intro}>{tZalo("intro")}</p>
        <ButtonLink href={`/tournaments/${tournament.id}/manage/zalo`} variant="secondary" block>
          {tZalo("open")}
        </ButtonLink>
      </Card>
    </main>
  );
}
