"use client";

import { useEffect, useState } from "react";
import { Sparkle } from "@/components/effects/sparkle";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./finish.module.css";

// Temporary cut from the mockup until the G2 badge set (#704) has the HOÀN THÀNH emblem.
const EMBLEM = "/art/mockup/screen-finish/finish-emblem";

type Props = {
  /** SeenMoment key of this finish; marked seen after the sparkle has played. None on the public page. */
  momentKey?: string;
  /** Play the sparkle (the player has not seen this finish yet). */
  play: boolean;
  alt: string;
};

/** The HOÀN THÀNH lighthouse emblem on a gold glow; sparkles once per finish. */
export function FinishCrest({ momentKey, play, alt }: Props) {
  // Start after mount, so the server and client render the same idle state.
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (play) setPlaying(true);
  }, [play]);

  function onDone() {
    if (!momentKey) return;
    void clientFetch("/api/me/moments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: momentKey }),
    }).catch(() => {});
  }

  return (
    <div className={styles.crest}>
      <picture>
        <source type="image/webp" srcSet="/art/mockup/effects/glow.webp" />
        <img src="/art/mockup/effects/glow.png" alt="" className={styles.glow} />
      </picture>
      <picture>
        <source type="image/webp" srcSet="/art/mockup/effects/completion-burst.webp" />
        <img src="/art/mockup/effects/completion-burst.png" alt="" className={styles.burstLeft} />
      </picture>
      <picture>
        <source type="image/webp" srcSet="/art/mockup/effects/completion-burst.webp" />
        <img src="/art/mockup/effects/completion-burst.png" alt="" className={styles.burstRight} />
      </picture>
      <Sparkle play={playing} onDone={onDone}>
        <picture>
          <source type="image/webp" srcSet={`${EMBLEM}.webp`} />
          <img src={`${EMBLEM}.png`} alt={alt} width={387} height={331} className={styles.emblem} />
        </picture>
      </Sparkle>
    </div>
  );
}
