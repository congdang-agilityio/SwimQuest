import { getTranslations } from "next-intl/server";
import { ScreenHeader } from "@/components/ui";
import { CreateTournamentForm } from "@/components/tournaments/create-tournament-form";
import styles from "@/components/tournaments/create-tournament.module.css";

export default async function NewTournamentPage() {
  const t = await getTranslations("tournaments");
  const tCommon = await getTranslations("common");
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader
          title={t("create.title")}
          backHref="/tournaments"
          backLabel={tCommon("back")}
        />
      </div>
      <CreateTournamentForm />
    </main>
  );
}
