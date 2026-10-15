"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./sparkle.module.css";

type Props = { play: boolean; onDone?: () => void; children?: ReactNode };

/** One short sparkle/glow around its children per `play`; a static glow when motion is reduced. */
export function Sparkle({ play, onDone, children }: Props) {
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (!play) return;
    if (reduce) return done.current?.();
    const id = setTimeout(() => done.current?.(), 1200);
    return () => clearTimeout(id);
  }, [play, reduce]);

  const motion = !play ? "idle" : reduce ? "static" : "animated";
  return (
    <span className={styles.root} data-testid="sparkle" data-motion={motion}>
      {children}
    </span>
  );
}
