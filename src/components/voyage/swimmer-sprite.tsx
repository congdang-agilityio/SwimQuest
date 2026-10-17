import { ArtImage } from "@/components/art/art-image";
import { EnergyOrb } from "@/components/collectibles/energy-orb";
import { mockupArt, toArtAsset } from "@/lib/art/mockup-art";
import styles from "./swimmer-sprite.module.css";

type Props = {
  /** Registry key of the pose (G2 `poses/`); freestyle by default. */
  pose?: string;
  /** The viewer's weekly multiplier is active: the swimmer carries the energy orb. */
  energyOrb?: boolean;
};

/**
 * A swimmer beside the team ship (G2 pose art). It glides and bobs as a whole (CSS transform,
 * never frame by frame) and stays still when reduced motion is requested. Decorative; the energy orb, when shown, is labelled.
 */
export function SwimmerSprite({ pose = "poses/freestyle-01", energyOrb = false }: Props) {
  const art = mockupArt(pose);
  if (!art) return null;
  return (
    // Decorative except for the orb, which carries its own label.
    <span className={styles.swimmer} data-testid="swimmer">
      <ArtImage art={toArtAsset(art)} alt="" className={styles.image} fallback={null} />
      {energyOrb && <EnergyOrb size={40} className={styles.orb} />}
    </span>
  );
}
