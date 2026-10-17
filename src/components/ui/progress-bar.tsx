import type { ReactNode } from "react";
import styles from "./ui.module.css";

type ProgressBarProps = {
  /** 0–100; clamped. */
  value: number;
  /** Accessible name ("Tiến độ của đội"). */
  label: string;
  /** Text shown above the bar, e.g. "42%" or "68 / 165 km". */
  caption?: ReactNode;
  /** light: on a light card. gold: the route bar on the voyage map. */
  tone?: "dark" | "light" | "gold";
};

export function ProgressBar({ value, label, caption, tone = "dark" }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const toneClass =
    tone === "light" ? styles.progressLight : tone === "gold" ? styles.progressGold : "";
  return (
    <div className={[styles.progress, toneClass].filter(Boolean).join(" ")}>
      {caption && <div className={styles.progressLabel}>{caption}</div>}
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
