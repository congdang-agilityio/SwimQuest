"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { StateCard } from "./state-card";

/** Plain-language error with a retry button. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("states.error");
  return (
    <StateCard
      art="effects/wave"
      role="alert"
      titleId="state-error"
      title={t("title")}
      body={t("body")}
    >
      <Button block onClick={onRetry}>
        {t("retry")}
      </Button>
    </StateCard>
  );
}
