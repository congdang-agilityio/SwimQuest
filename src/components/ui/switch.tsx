"use client";

import type { ReactNode } from "react";
import styles from "./ui.module.css";

/** An on/off setting: a `role="switch"` button named by its label, with an optional hint line. */
export function Switch({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className={styles.switchRow}>
      <span className={styles.switchText}>
        <span id={`${id}-label`} className={styles.switchLabel}>
          {label}
        </span>
        {hint ? (
          <span id={`${id}-hint`} className={styles.switchHint}>
            {hint}
          </span>
        ) : null}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}
