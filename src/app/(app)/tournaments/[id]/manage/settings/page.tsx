import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const swim = (await getSettings(tournament.id))?.swim as SwimRulesValues | undefined;
  if (!swim) notFound();
  const status = effectiveStatus(tournament, new Date());
  const t = await getTranslations("settings");
  return (
    <main>
      <h1>{t("page.title")}</h1>
      <p>
        <Link href={`/tournaments/${tournament.id}/manage`}>{t("page.back")}</Link>
      </p>
      <SwimSettingsForm
        tournamentId={tournament.id}
        values={swim}
        locked={status !== "DRAFT" && status !== "PUBLISHED"}
      />
    </main>
  );
}
