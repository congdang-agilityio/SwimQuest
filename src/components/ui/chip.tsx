import type { HTMLAttributes } from "react";
import styles from "./ui.module.css";

export type ChipTone = "neutral" | "info" | "success" | "warning" | "danger" | "gold";

const TONE: Record<ChipTone, string | undefined> = {
  neutral: undefined,
  info: styles.chipInfo,
  success: styles.chipSuccess,
  warning: styles.chipWarning,
  danger: styles.chipDanger,
  gold: styles.chipGold,
};

/** Small rounded label ("20 đội · Công khai", status badges). Always carries text, never colour alone. */
export function Chip({
  tone = "neutral",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: ChipTone }) {
  return (
    <span className={[styles.chip, TONE[tone], className].filter(Boolean).join(" ")} {...rest} />
  );
}

export const Badge = Chip;
