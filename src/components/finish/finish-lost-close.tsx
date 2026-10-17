"use client";

import { useState } from "react";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./finish.module.css";

/** Close button of the finish-lost notice: hides it and marks the moment seen. */
export function FinishLostClose({ momentKey, label }: { momentKey: string; label: string }) {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <button
      type="button"
      className={styles.lostClose}
      aria-label={label}
      onClick={() => {
        setClosed(true);
        void clientFetch("/api/me/moments", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: momentKey }),
        }).catch(() => {});
      }}
    >
      ×
    </button>
  );
}
