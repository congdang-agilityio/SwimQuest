import { getTranslations } from "next-intl/server";
import { CreateTournamentForm } from "@/components/tournaments/create-tournament-form";

export default async function NewTournamentPage() {
  const t = await getTranslations("tournaments");
  return (
    <main>
      <h1>{t("create.title")}</h1>
      <CreateTournamentForm />
    </main>
  );
}
