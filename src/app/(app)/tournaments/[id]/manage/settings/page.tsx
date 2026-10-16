import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DeadlineSettingsForm } from "@/components/settings/deadline-settings-form";
import { SwimSettingsForm } from "@/components/settings/swim-settings-form";
import type { SwimRulesValues } from "@/components/tournaments/rules/swim-rules";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { effectiveStatus } from "@/lib/tournaments/lifecycle";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizer } from "@/server/auth/roles";
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
  if (!swim || !deadlines) notFound();
  const status = effectiveStatus(tournament, new Date());
  const locked = status !== "DRAFT" && status !== "PUBLISHED";
  const t = await getTranslations("settings");
  return (
    <main>
      <h1>{t("page.title")}</h1>
      <p>
        <Link href={`/tournaments/${tournament.id}/manage`}>{t("page.back")}</Link>
      </p>
      <SwimSettingsForm tournamentId={tournament.id} values={swim} locked={locked} />
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
    </main>
  );
}
