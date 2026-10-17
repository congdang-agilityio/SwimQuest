import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui";
import { StateCard } from "./state-card";

/** Shown for a page that does not exist (or that the user may not know exists). */
export function NotFoundState() {
  const t = useTranslations("states.notFound");
  return (
    <StateCard
      art="items/treasure-map"
      titleId="state-not-found"
      title={t("title")}
      body={t("body")}
    >
      <ButtonLink href="/" block>
        {t("home")}
      </ButtonLink>
    </StateCard>
  );
}
