import { useTranslations } from "next-intl";
import { StateCard } from "./state-card";

/** Announced to assistive tech as a status while content loads. */
export function LoadingState() {
  const t = useTranslations("states.loading");
  return (
    <div role="status" aria-live="polite">
      <StateCard art="effects/wave" titleId="state-loading" title={`${t("label")}…`} />
    </div>
  );
}
