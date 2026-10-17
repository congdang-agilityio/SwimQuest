"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button, Card } from "@/components/ui";
import styles from "./leave-confirm.module.css";

/** In-page "discard unsaved changes?" prompt. Keep editing is the default and Escape. */
export function LeaveConfirm({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  const t = useTranslations("profile.leave");
  const keepRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    keepRef.current?.querySelector("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKeep();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onKeep]);
  return (
    <div ref={keepRef} className={styles.scrim}>
      <Card
        as="section"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-title"
        aria-describedby="leave-body"
        className={styles.dialog}
      >
        <h2 id="leave-title" className={styles.title}>
          {t("title")}
        </h2>
        <p id="leave-body" className={styles.body}>
          {t("body")}
        </p>
        <div className={styles.actions}>
          <Button onClick={onKeep}>{t("keep")}</Button>
          <Button variant="ghost" onClick={onDiscard}>
            {t("discard")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
