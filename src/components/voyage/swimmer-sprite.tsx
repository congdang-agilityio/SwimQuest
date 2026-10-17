import { ArtImage } from "@/components/art/art-image";
import { mockupArt, toArtAsset } from "@/lib/art/mockup-art";
import styles from "./swimmer-sprite.module.css";

type Props = {
  /** Registry key of the pose (G2 `poses/`); freestyle by default. */
  pose?: string;
};

/**
 * A swimmer beside the team ship (G2 pose art). It glides and bobs as a whole (CSS transform,
 * never frame by frame) and stays still when reduced motion is requested. Decorative.
 */
export function SwimmerSprite({ pose = "poses/freestyle-01" }: Props) {
  const art = mockupArt(pose);
  if (!art) return null;
  return (
    <span className={styles.swimmer} data-testid="swimmer" aria-hidden="true">
      <ArtImage art={toArtAsset(art)} alt="" className={styles.image} fallback={null} />
    </span>
  );
}
