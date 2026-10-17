import { MockupPicture } from "@/components/art/mockup-picture";
import { imageSrc } from "@/lib/profile-avatar";
import styles from "./tournament-banner.module.css";

type Props = {
  /** Tournament name, rendered as live text over the banner. */
  name: string;
  /** The organizer's uploaded banner; without it the sea template from the asset sheets shows. */
  bannerImageId?: string | null;
  /** id of the name heading, for aria-labelledby on the surrounding card. */
  headingId?: string;
};

/**
 * Tournament banner: the uploaded image or the template scene (G1 `scenes/sea-ly-son-16x9`, no
 * painted text), with the tournament name over a dark scrim so it stays readable and wraps.
 */
export function TournamentBanner({ name, bannerImageId, headingId }: Props) {
  const uploaded = imageSrc(bannerImageId);
  return (
    <div className={styles.banner} data-testid="tournament-banner">
      {uploaded ? (
        // eslint-disable-next-line @next/next/no-img-element -- organizer upload, served sized by the images API
        <img src={uploaded} alt="" className={styles.image} />
      ) : (
        <MockupPicture
          artKey="scenes/sea-ly-son-16x9"
          alt=""
          className={styles.image}
          eager
          fallback={null}
        />
      )}
      <h2 id={headingId} className={styles.name}>
        {name}
      </h2>
    </div>
  );
}
