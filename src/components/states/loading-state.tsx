import { useTranslations } from "next-intl";

/** Announced to assistive tech as a status while content loads. */
export function LoadingState() {
  const t = useTranslations("states.loading");
  return (
    <div role="status" aria-live="polite">
      {t("label")}…
    </div>
  );
}
