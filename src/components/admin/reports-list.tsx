"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Button, Chip, SectionHeader, Tabs, TextareaField, type ChipTone } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./admin.module.css";

type Status = "OPEN" | "HANDLED" | "DISMISSED";
type TargetType = "PLAYER" | "TEAM" | "TOURNAMENT" | "SWIM";

export type AdminReport = {
  id: string;
  target: { type: TargetType; id: string; label: string | null; tournamentId: string | null };
  text: string;
  status: Status;
  note: string | null;
  createdAt: string;
  reporter: { id: string; displayName: string; email: string };
};

type Page = { reports: AdminReport[]; nextCursor: string | null };

const NOTE_MAX = 500;
const FILTERS = ["ALL", "OPEN", "HANDLED", "DISMISSED"] as const;
const KNOWN_ERRORS = ["REASON_REQUIRED", "ALREADY_DECIDED", "FORBIDDEN", "NOT_FOUND"];
const TONE: Record<Status, ChipTone> = {
  OPEN: "warning",
  HANDLED: "success",
  DISMISSED: "neutral",
};

/** Where an admin can look at the reported thing; swims and team pages are not open to admins. */
function targetHref({ type, id, tournamentId }: AdminReport["target"]): string | null {
  if (type === "PLAYER") return `/players/${id}`;
  if (type === "TOURNAMENT") return `/tournaments/${id}`;
  if (type === "TEAM" && tournamentId) return `/tournaments/${tournamentId}`;
  return null;
}

/** Admin reports queue (open first): who reported what and when, and closing one with a note. */
export function ReportsList() {
  const t = useTranslations("admin.reports");
  const format = useFormatter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [items, setItems] = useState<AdminReport[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [closing, setClosing] = useState<{ id: string; status: "HANDLED" | "DISMISSED" } | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0); // ignore answers to an older filter
  const inFlight = useRef(false);

  const load = useCallback(async (status: string, after: string | null) => {
    const run = ++latest.current;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (after) params.set("cursor", after);
    const res = await clientFetch(`/api/admin/reports?${params}`).catch(() => null);
    const page: Page | null = res?.ok ? await res.json().catch(() => null) : null;
    if (run !== latest.current) return;
    if (!page) setFailed(true);
    else {
      setItems((prev) => (after ? [...prev, ...page.reports] : page.reports));
      setCursor(page.nextCursor);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(filter, null);
  }, [load, filter]);

  const trimmed = note.trim();

  async function close() {
    if (!closing || inFlight.current || trimmed.length < 1 || note.length > NOTE_MAX) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await clientFetch(`/api/admin/reports/${closing.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: closing.status, note: trimmed }),
      }).catch(() => null);
      if (!res) setError("network");
      else if (res.ok) {
        setClosing(null);
        setNote("");
        await load(filter, null);
      } else {
        const body = await res.json().catch(() => null);
        const code = String(body?.error?.code ?? body?.code ?? "");
        setError(KNOWN_ERRORS.includes(code) ? code : "failed");
        if (code === "ALREADY_DECIDED") {
          setClosing(null);
          await load(filter, null);
        }
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="reports-title" className={styles.panel}>
      <SectionHeader id="reports-title">{t("listTitle")}</SectionHeader>
      <div className={styles.panelBody}>
        <div className={styles.filters}>
          <Tabs
            label={t("filterLabel")}
            value={filter}
            items={FILTERS.map((id) => ({ id, label: t(`filter.${id}`) }))}
            onChange={(id) => setFilter(id as (typeof FILTERS)[number])}
          />
        </div>
        {failed && (
          <div className={styles.confirm}>
            <p role="alert" className={styles.error}>
              {t("loadError")}
            </p>
            <Button variant="secondary" onClick={() => void load(filter, cursor)}>
              {t("retry")}
            </Button>
          </div>
        )}
        {!loading && !failed && items.length === 0 && <p className={styles.muted}>{t("empty")}</p>}
        <ul className={styles.list}>
          {items.map((r) => {
            const href = targetHref(r.target);
            const label = r.target.label ?? t("targetUnknown");
            const isClosing = closing?.id === r.id;
            return (
              <li key={r.id} className={styles.reportCard}>
                <span className={styles.chips}>
                  <Chip tone={TONE[r.status]}>{t(`status.${r.status}`)}</Chip>
                  <Chip tone="info">{t(`targetType.${r.target.type}`)}</Chip>
                </span>
                <span className={styles.name}>
                  {href ? (
                    <Link href={href} className={styles.link}>
                      {label}
                    </Link>
                  ) : (
                    label
                  )}
                </span>
                <p className={styles.reportText}>{r.text}</p>
                <dl className={styles.facts}>
                  <div className={styles.fact}>
                    <dt>{t("reportedBy")}</dt>
                    <dd>
                      {r.reporter.displayName} ({r.reporter.email})
                    </dd>
                  </div>
                  <div className={styles.fact}>
                    <dt>{t("sentAt")}</dt>
                    <dd>
                      {format.dateTime(new Date(r.createdAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </dd>
                  </div>
                  {r.note && (
                    <div className={styles.fact}>
                      <dt>{t("internalNote")}</dt>
                      <dd>{r.note}</dd>
                    </div>
                  )}
                </dl>
                {r.status === "OPEN" && !isClosing && (
                  <span className={styles.actions}>
                    {(["HANDLED", "DISMISSED"] as const).map((status) => (
                      <Button
                        key={status}
                        variant={status === "HANDLED" ? "primary" : "secondary"}
                        onClick={() => {
                          setClosing({ id: r.id, status });
                          setNote("");
                          setError(null);
                        }}
                      >
                        {t(`close.${status}`)}
                      </Button>
                    ))}
                  </span>
                )}
                {isClosing && closing && (
                  <div
                    role="alertdialog"
                    aria-label={t(`close.${closing.status}`)}
                    className={styles.confirm}
                  >
                    <TextareaField
                      id={`report-note-${r.id}`}
                      label={t("noteLabel")}
                      hint={t("noteHint", { max: NOTE_MAX })}
                      error={
                        error === "REASON_REQUIRED" || note.length > NOTE_MAX
                          ? t("errors.REASON_REQUIRED")
                          : undefined
                      }
                      value={note}
                      rows={3}
                      maxLength={NOTE_MAX + 100}
                      onChange={(e) => {
                        setNote(e.target.value);
                        if (error === "REASON_REQUIRED") setError(null);
                      }}
                    />
                    <span className={styles.actions}>
                      <Button
                        variant="primary"
                        onClick={close}
                        disabled={busy || trimmed.length < 1 || note.length > NOTE_MAX}
                      >
                        {busy ? t("saving") : t("confirmYes")}
                      </Button>
                      <Button variant="secondary" onClick={() => setClosing(null)} disabled={busy}>
                        {t("cancel")}
                      </Button>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {error && error !== "REASON_REQUIRED" && (
          <p role="alert" className={styles.error}>
            {t(`errors.${error}`)}
          </p>
        )}
        {loading && <p className={styles.muted}>{t("loading")}</p>}
        {cursor && !loading && (
          <Button variant="secondary" onClick={() => void load(filter, cursor)}>
            {t("loadMore")}
          </Button>
        )}
      </div>
    </section>
  );
}
