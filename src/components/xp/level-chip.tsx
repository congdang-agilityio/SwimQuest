import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui";

/**
 * The player level as a gold chip. "short" is the mockup's "Lv. 12" under the name on Home; the
 * accessible name is always the full "Level 12", so the level is never colour or shorthand only.
 */
export function LevelChip({ level, short = false }: { level: number; short?: boolean }) {
  const t = useTranslations("xp");
  return (
    <Chip tone="gold" aria-label={short ? t("level", { level }) : undefined}>
      {short ? t("levelShort", { level }) : t("level", { level })}
    </Chip>
  );
}
