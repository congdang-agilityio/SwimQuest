import { useTranslations } from "next-intl";
import { ButtonLink } from "@/components/ui";
import { StateCard } from "./state-card";

/** Shown when the user may not view a page; the home page is `/`. */
export function AccessDenied() {
  const t = useTranslations("states.accessDenied");
  return (
    <StateCard
      art="items/message-bottle"
      titleId="state-denied"
      title={t("title")}
      body={t("body")}
    >
      <ButtonLink href="/" block>
        {t("home")}
      </ButtonLink>
    </StateCard>
  );
}
