"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, SelectField, TextareaField } from "@/components/ui";
import styles from "@/components/starts/organizer-start-panel.module.css";
import pickerStyles from "@/components/starts/start-picker.module.css";
import { clientFetch } from "@/lib/http/client-fetch";

type StartOption = { slug: string; nameKey: string };
type Failure =
  | "sameStart"
  | "START_NOT_LOCKED"
  | "ARCHIVED"
  | "INVALID_START"
  | "forbidden"
  | "network"
  | "failed";

type Props = {
  teamId: string;
  /** Start destinations (never the finish), in route order. */
  starts: readonly StartOption[];
  currentSlug: string | null;
};

/**
 * Platform admin's exceptional correction of a locked start (S-72 AC 3): pick a start and give a
 * reason, confirm in the page, then the page refreshes. Rendered for platform admins only.
 */
export function StartCorrectionDialog({ teamId, starts, currentSlug }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState(currentSlug ?? starts[0]?.slug ?? "");
  const [reason, setReason] = useState("");
  const [reasonMissing, setReasonMissing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const inFlight = useRef(false);

  const nameOf = (s: string | null) => {
    const key = starts.find((o) => o.slug === s)?.nameKey;
    return key ? t(key) : t("starts.card.notChosen");
  };

  function review(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (reason.trim() === "") return setReasonMissing(true);
    if (slug === currentSlug) return setError("sameStart");
    setConfirming(true);
  }

  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await clientFetch(`/api/admin/teams/${encodeURIComponent(teamId)}/start`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, reason: reason.trim() }),
      }).catch(() => null);
      if (!res) setError("network");
      else if (res.ok) {
        setDone(t("admin.startCorrection.done", { name: nameOf(slug) }));
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        const code = body?.error?.code;
        if (code === "START_NOT_LOCKED" || code === "ARCHIVED" || code === "INVALID_START")
          setError(code);
        else if (code === "REASON_REQUIRED") setReasonMissing(true);
        else setError(res.status === 403 ? "forbidden" : "failed");
      }
    } finally {
      setConfirming(false);
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="start-correction-title" className={styles.panel}>
      <h2 id="start-correction-title" className={styles.current}>
        {t("admin.startCorrection.title")}
      </h2>
      <p className={styles.note}>{t("admin.startCorrection.help")}</p>
      {done && (
        <p role="status" className={styles.note}>
          {done}
        </p>
      )}
      {open ? (
        <form onSubmit={review} noValidate className={pickerStyles.form}>
          <SelectField
            id={`start-correction-slug-${teamId}`}
            label={t("admin.startCorrection.startLabel")}
            value={slug}
            disabled={confirming || busy}
            onChange={(e) => {
              setSlug(e.target.value);
              setError(null);
            }}
          >
            {starts.map((s) => (
              <option key={s.slug} value={s.slug}>
                {t(s.nameKey)}
              </option>
            ))}
          </SelectField>
          <TextareaField
            id={`start-correction-reason-${teamId}`}
            label={t("admin.startCorrection.reason")}
            hint={t("admin.startCorrection.reasonHint")}
            error={reasonMissing ? t("admin.startCorrection.reasonRequired") : undefined}
            value={reason}
            disabled={confirming || busy}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonMissing(false);
            }}
            maxLength={300}
            rows={3}
            required
          />
          {confirming ? (
            <div
              role="alertdialog"
              aria-label={t("admin.startCorrection.confirmTitle")}
              className={styles.confirm}
            >
              <p className={styles.confirmTitle}>{t("admin.startCorrection.confirmTitle")}</p>
              <p className={styles.confirmBody}>
                {t("admin.startCorrection.confirmBody", {
                  from: nameOf(currentSlug),
                  to: nameOf(slug),
                })}
              </p>
              <div className={styles.actions}>
                <Button type="button" disabled={busy} onClick={() => void save()}>
                  {busy ? t("admin.startCorrection.saving") : t("admin.startCorrection.confirmYes")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                >
                  {t("admin.startCorrection.back")}
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              <Button type="submit">{t("admin.startCorrection.continue")}</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                  setReasonMissing(false);
                }}
              >
                {t("admin.startCorrection.cancel")}
              </Button>
            </div>
          )}
        </form>
      ) : (
        <Button
          variant="secondary"
          block
          onClick={() => {
            setDone(null);
            setSlug(currentSlug ?? starts[0]?.slug ?? "");
            setOpen(true);
          }}
        >
          {t("admin.startCorrection.open")}
        </Button>
      )}
      {error && (
        <p role="alert" className={pickerStyles.error}>
          {t(`admin.startCorrection.errors.${error}`)}
        </p>
      )}
    </section>
  );
}
