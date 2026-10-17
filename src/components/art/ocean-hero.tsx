import { MockupPicture } from "./mockup-picture";
import { OceanHeroVector } from "./ocean-hero-vector";
import styles from "./ocean-hero.module.css";

/**
 * Decorative welcome hero: the swimmers-at-sea scene cut from asset sheet B (no text in the art),
 * at 16:9 so both swimmers stay in frame. Falls back to the earlier vector scene.
 */
export function OceanHero({ className }: { className?: string }) {
  return (
    <div className={[styles.hero, className].filter(Boolean).join(" ")} aria-hidden="true">
      <MockupPicture
        artKey="scenes/hero-swimmers-16x9"
        alt=""
        className={styles.photo}
        eager
        fallback={<OceanHeroVector className={styles.fill} />}
      />
    </div>
  );
}
