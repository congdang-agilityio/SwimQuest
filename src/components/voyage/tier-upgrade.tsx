"use client";

import { useEffect, useState } from "react";
import { ArtImage } from "@/components/art/art-image";
import { Sparkle } from "@/components/effects/sparkle";
import { shipArt } from "@/lib/art/route01-art";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./tier-upgrade.module.css";

type Props = {
  /** SeenMoment key `tier:<teamId>:<tier>`; marked seen once the effect has played. */
  momentKey: string;
  tier: number;
  shipAlt: string;
  caption: string;
};

function Effect({ name, className }: { name: string; className: string }) {
  return (
    <picture>
      <source type="image/webp" srcSet={`/art/mockup/effects/${name}.webp`} />
      <img src={`/art/mockup/effects/${name}.png`} alt="" className={className} />
    </picture>
  );
}

/**
 * The first time a member opens Voyage after the team reached a new ship tier: the new ship on a
 * glow with bursts and a short caption, then the moment is marked seen. Reduced motion shows the
 * caption only (the effect art is hidden by CSS).
 */
export function TierUpgrade({ momentKey, tier, shipAlt, caption }: Props) {
  // Start after mount, so the server and client render the same idle state.
  const [playing, setPlaying] = useState(false);
  useEffect(() => setPlaying(true), []);

  function onDone() {
    void clientFetch("/api/me/moments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: momentKey }),
    }).catch(() => {});
  }

  return (
    <section className={styles.upgrade} data-testid="tier-upgrade" data-tier={tier}>
      <div className={styles.stage} data-effect>
        <Effect name="glow" className={styles.glow} />
        <Effect name="splash-ring" className={styles.ring} />
        <Effect name="completion-burst" className={styles.burstLeft} />
        <Effect name="completion-burst" className={styles.burstRight} />
        <Sparkle play={playing} onDone={onDone}>
          <ArtImage
            art={shipArt(tier)}
            alt={shipAlt}
            className={styles.ship}
            fallback={<span aria-hidden="true">⛵</span>}
          />
        </Sparkle>
      </div>
      <p className={styles.caption} role="status">
        {caption}
      </p>
    </section>
  );
}
