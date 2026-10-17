"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, TextareaField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./report-button.module.css";

export type ReportTargetType = "PLAYER" | "TEAM" | "TOURNAMENT" | "SWIM";

const TEXT_MIN = 10;
const TEXT_MAX = 1000;

type Failure = "tooShort" | "tooLong" | "rateLimited" | "notFound" | "failed" | "network";

/**
 * "Report" button that opens an in-page dialog: a textarea with a character counter and a send
 * button. The confirmation says only that platform admins will read the report; it never repeats
 * anything about the target.
 */
export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: ReportTargetType;
  targetId: string;
}) {
  const t = useTranslations("reports");
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const inFlight = useRef(false); // blocks a second click before React re-renders
  const opener = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setError(null);
    if (done) {
      setDone(false);
      setText("");
    }
    opener.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    (dialog.current?.querySelector("textarea, button") as HTMLElement | null)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close only reads state to reset it
  }, [open, done]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    const trimmed = text.trim();
    if (trimmed.length < TEXT_MIN) return setError("tooShort");
    if (trimmed.length > TEXT_MAX) return setError("tooLong");
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await clientFetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetType, targetId, text: trimmed }),
      }).catch(() => null);
      if (!res) setError("network");
      else if (res.ok) setDone(true);
      else if (res.status === 429) setError("rateLimited");
      else if (res.status === 404) setError("notFound");
      else if (res.status === 400) setError(trimmed.length < TEXT_MIN ? "tooShort" : "tooLong");
      else setError("failed");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const titleId = `${uid}-title`;
  const length = text.length;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={styles.opener}
        aria-haspopup="dialog"
        onClick={(e) => {
          opener.current = e.currentTarget;
          setOpen(true);
        }}
      >
        {t("button")}
      </Button>
      {open && (
        <div className={styles.scrim}>
          <Card
            as="section"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={styles.dialog}
          >
            <div ref={dialog} className={styles.content}>
              <h2 id={titleId} className={styles.title}>
                {done ? t("doneTitle") : t("title")}
              </h2>
              {done ? (
                <>
                  <p role="status" className={styles.body}>
                    {t("done")}
                  </p>
                  <Button type="button" onClick={close}>
                    {t("close")}
                  </Button>
                </>
              ) : (
                <form onSubmit={send} className={styles.form} noValidate>
                  <p className={styles.body}>{t("intro")}</p>
                  <TextareaField
                    id={`${uid}-text`}
                    label={t("label")}
                    rows={5}
                    value={text}
                    maxLength={TEXT_MAX}
                    onChange={(e) => setText(e.target.value)}
                    hint={
                      <span aria-live="polite">
                        {t("counter", { count: length, min: TEXT_MIN, max: TEXT_MAX })}
                      </span>
                    }
                    error={
                      error ? t(`errors.${error}`, { min: TEXT_MIN, max: TEXT_MAX }) : undefined
                    }
                  />
                  <div className={styles.actions}>
                    <Button type="submit" disabled={busy}>
                      {busy ? t("sending") : t("send")}
                    </Button>
                    <Button type="button" variant="ghost" onClick={close}>
                      {t("cancel")}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
