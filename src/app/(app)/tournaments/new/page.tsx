import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ScreenHeader } from "@/components/ui";
import { CreateTournamentForm } from "@/components/tournaments/create-tournament-form";
import { QuotaRequest } from "@/components/tournaments/quota-request";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { recordFunnelEventSafe } from "@/server/funnel/safe";
import { getQuota } from "@/server/tournaments/quota";
import styles from "@/components/tournaments/create-tournament.module.css";

export default async function NewTournamentPage() {
  const t = await getTranslations("tournaments");
  const tCommon = await getTranslations("common");
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/tournaments/new");
  const quota = await getQuota(user.id);
  await recordFunnelEventSafe("tournament_create_started", { userId: user.id });
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader
          title={t("create.title")}
          backHref="/tournaments"
          backLabel={tCommon("back")}
        />
      </div>
      {/* At the limit the request option replaces the form (S-61). */}
      {quota.used >= quota.allowed ? (
        <QuotaRequest used={quota.used} allowed={quota.allowed} request={quota.request} />
      ) : (
        <CreateTournamentForm />
      )}
    </main>
  );
}
