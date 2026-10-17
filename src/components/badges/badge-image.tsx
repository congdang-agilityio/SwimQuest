import { useTranslations } from "next-intl";
import { badgeArt } from "@/lib/art/badge-art";
import styles from "./badge-image.module.css";

/** A badge's G2 art with its localized kind name as text (the art itself is decorative). */
export function BadgeImage({ kind, size = 64 }: { kind: string; size?: number }) {
  const t = useTranslations("players.kind");
  const art = badgeArt(kind);
  return (
    <span className={styles.badge}>
      {art && (
        // eslint-disable-next-line @next/next/no-img-element -- small static art
        <img src={art.webp} alt="" width={size} height={size} />
      )}
      <span className={styles.name}>{t.has(kind) ? t(kind) : kind}</span>
    </span>
  );
}
