"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import styles from "./finish-card.module.css";

type Props = {
  /** Path of the public finish page, e.g. `/finish/<token>`. */
  path: string;
  /** Share sheet title and text, from messages. */
  title: string;
  text: string;
  labels: { button: string; copied: string; failed: string };
};

/**
 * "Chia sẻ thành tích" (S-82): opens the phone's share menu (Web Share API) with the public
 * finish link; without it, copies the link and says so.
 */
export function ShareFinishButton({ path, title, text, labels }: Props) {
  const [status, setStatus] = useState("");

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    setStatus("");
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // The player closed the share menu: nothing to report.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus(labels.copied);
    } catch {
      setStatus(labels.failed);
    }
  }

  return (
    <div className={styles.share}>
      <Button variant="primary" block onClick={share} data-testid="finish-share">
        {labels.button}
      </Button>
      <p className={styles.status} role="status">
        {status}
      </p>
    </div>
  );
}
