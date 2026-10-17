import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import manage from "@/components/tournaments/manage.module.css";
import { ZaloSettingsPanel } from "@/components/zalo/zalo-settings";
import { ScreenHeader } from "@/components/ui";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { ForbiddenError, NotFoundError, requireOrganizer } from "@/server/auth/roles";
import { isZaloConfigured } from "@/server/zalo/secret";
import { getZaloSettings } from "@/server/zalo/settings";

export const dynamic = "force-dynamic";

/** "Zalo group" (S-85): setup steps, the bot key and the group link. Organizer only. */
export default async function ZaloGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments");
  const tournament = await requireOrganizer(user.id, id).catch((err: unknown) => {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) notFound();
    throw err;
  });
  const zalo = await getZaloSettings(user.id, tournament.id);
  const t = await getTranslations("zalo");
  const tCommon = await getTranslations("common");
  return (
    <main className={manage.screen}>
      <div className={manage.headerBand}>
        <ScreenHeader
          title={t("title")}
          backHref={`/tournaments/${tournament.id}/manage`}
          backLabel={tCommon("back")}
        />
      </div>
      <ZaloSettingsPanel
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        configured={isZaloConfigured()}
        closed={tournament.status === "COMPLETED" || tournament.status === "ARCHIVED"}
        initial={
          zalo && {
            botName: zalo.botName,
            keyHint: zalo.keyHint,
            connected: zalo.connected,
            linkedAt: zalo.linkedAt?.toISOString() ?? null,
            webhookOk: zalo.webhookOk,
            switches: zalo.switches,
            lastError: zalo.lastError,
            lastErrorAt: zalo.lastErrorAt?.toISOString() ?? null,
            failedCount: zalo.failedCount,
          }
        }
      />
    </main>
  );
}
