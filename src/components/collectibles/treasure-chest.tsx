"use client";

import { useEffect, useState } from "react";
import { MockupPicture } from "@/components/art/mockup-picture";
import { Sparkle } from "@/components/effects/sparkle";
import { Chip } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./collectibles.module.css";

type Props = {
  artKey: string;
  /** SeenMoment key `chest:<teamId>:<chest>`; marked seen once the opening has played. */
  momentKey: string;
  /** The viewer already saw this chest open: shown opened, no effect. */
  seen: boolean;
  label: string;
  newLabel: string;
};

/**
 * A team treasure chest. The first time a member sees it, the chest shakes open with a burst and a
 * sparkle, then the moment is marked seen so it never plays again for that member. With reduced
 * motion it is shown opened at once (the moment is still marked).
 */
export function TreasureChest({ artKey, momentKey, seen, label, newLabel }: Props) {
  // Start after mount, so the server and client render the same closed state.
  const [state, setState] = useState<"closed" | "opening" | "opened">(seen ? "opened" : "closed");
  useEffect(() => {
    if (!seen) setState("opening");
  }, [seen]);

  function onDone() {
    setState("opened");
    void clientFetch("/api/me/moments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: momentKey }),
    }).catch(() => {});
  }

  return (
    <>
      <span className={styles.stage} data-state={state}>
        <MockupPicture artKey="effects/glow" alt="" className={styles.glow} />
        <MockupPicture artKey="effects/completion-burst" alt="" className={styles.burst} />
        <Sparkle play={state === "opening"} onDone={onDone}>
          <MockupPicture artKey={artKey} alt={label} className={styles.art} />
        </Sparkle>
      </span>
      <span className={styles.label}>{label}</span>
      {!seen && (
        <Chip tone="gold" className={styles.newChip}>
          {newLabel}
        </Chip>
      )}
    </>
  );
}
