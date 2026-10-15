"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./sparkle.module.css";

const DURATION_MS = 1200;

type Props = { play: boolean; onDone?: () => void; children?: ReactNode };

/** Plays a short sparkle/glow around its children once per `play`; static glow when motion is reduced. */
export function Sparkle({ play, onDone, children }: Props) {
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!play) return;
    if (reduce) {
      done.current?.();
      return;
    }
    const id = setTimeout(() => done.current?.(), DURATION_MS);
    return () => clearTimeout(id);
  }, [play, reduce]);

  const motion = !play ? "idle" : reduce ? "static" : "animated";
  return (
    <span className={styles.root} data-testid="sparkle" data-motion={motion}>
      {children}
      {play && (
        <span aria-hidden="true" className={styles.fx}>
          {!reduce && (
            <>
              <i className={styles.star} />
              <i className={styles.star} />
              <i className={styles.star} />
              <i className={styles.star} />
            </>
          )}
        </span>
      )}
    </span>
  );
}
