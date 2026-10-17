"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { MockupPicture } from "@/components/art/mockup-picture";
import { Button, Card, Chip, Field, SectionHeader } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import type { ZaloSwitches } from "@/server/zalo/switch-kinds";
import { ZaloProblem } from "./zalo-problem";
import { ZaloSwitchesPanel } from "./zalo-switches";
import styles from "./zalo.module.css";

/** The organizer's view of the bot: never the key. */
export type ZaloView = {
  botName: string;
  keyHint: string;
  connected: boolean;
  linkedAt: string | null;
  webhookOk: boolean;
  switches: ZaloSwitches;
  lastError: string | null;
  lastErrorAt: string | null;
  failedCount: number;
};

type Failure =
  "notConfigured" | "rejected" | "unreachable" | "closed" | "failed" | "network" | "server";

const CODES: Record<string, Failure> = {
  ZALO_NOT_CONFIGURED: "notConfigured",
  ZALO_KEY_REJECTED: "rejected",
  ZALO_UNREACHABLE: "unreachable",
  TOURNAMENT_CLOSED: "closed",
};

const STEPS = ["create", "paste", "add", "mention"] as const;

type Props = {
  tournamentId: string;
  tournamentName: string;
  /** `ZALO_KEY_SECRET` is set on this server. */
  configured: boolean;
  /** Completed or archived: settings are read-only. */
  closed: boolean;
  initial: ZaloView | null;
};

/** "Zalo group" settings body (S-85): steps, key form, connection status and removal. */
export function ZaloSettingsPanel({
  tournamentId,
  tournamentName,
  configured,
  closed,
  initial,
}: Props) {
  const t = useTranslations("zalo");
  const format = useFormatter();
  const router = useRouter();
  const [zalo, setZalo] = useState<ZaloView | null>(initial);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(!configured);
  const inFlight = useRef(false);
  const url = `/api/tournaments/${encodeURIComponent(tournamentId)}/zalo`;

  async function call(init: RequestInit): Promise<{ zalo: ZaloView | null } | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    setServerMessage(null);
    setSaved(false);
    try {
      const res = await clientFetch(url, init).catch(() => null);
      if (!res) {
        setFailure("network");
        return null;
      }
      const body = await res.json().catch(() => null);
      if (res.ok) return { zalo: (body?.zalo ?? null) as ZaloView | null };
      const code: unknown = body?.error?.code;
      const fieldMessage: unknown = body?.error?.fields?.key;
      const failed = (typeof code === "string" && CODES[code]) || null;
      if (failed === "notConfigured") setNotConfigured(true);
      if (!failed && typeof fieldMessage === "string") {
        setFailure("server");
        setServerMessage(fieldMessage);
      } else {
        setFailure(failed ?? "failed");
      }
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!key.trim()) return;
    const result = await call({
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    });
    // The key never stays in the page, whatever the answer.
    setKey("");
    if (result) {
      setZalo(result.zalo);
      setSaved(true);
      router.refresh();
    }
  }

  async function onRemove() {
    const result = await call({ method: "DELETE" });
    if (result) {
      setZalo(null);
      setConfirming(false);
      router.refresh();
    }
  }

  const error =
    failure === "server" && serverMessage ? serverMessage : failure ? t(`errors.${failure}`) : null;
  const readOnly = closed || notConfigured;

  return (
    <>
      <Card className={styles.intro}>
        <MockupPicture artKey="items/message-bottle" alt="" className={styles.introArt} />
        <div className={styles.introText}>
          <p className={styles.tournament}>{tournamentName}</p>
          <p>{t("intro")}</p>
        </div>
      </Card>

      {notConfigured && (
        <Card role="status" className={styles.notConfigured} data-testid="zalo-not-configured">
          <h2 className={styles.noticeTitle}>{t("notConfigured.title")}</h2>
          <p>{t("notConfigured.body")}</p>
        </Card>
      )}

      {zalo?.lastError && (
        <ZaloProblem reason={zalo.lastError} at={zalo.lastErrorAt} failedCount={zalo.failedCount} />
      )}

      <section aria-labelledby="zalo-status-title" className={styles.panel}>
        <SectionHeader id="zalo-status-title">{t("status.title")}</SectionHeader>
        <div className={styles.body}>
          {zalo ? (
            <div className={styles.bot} data-testid="zalo-bot">
              <div className={styles.botLine}>
                <span className={styles.botName}>{zalo.botName}</span>
                {zalo.connected ? (
                  <Chip tone="success">{t("status.connectedChip")}</Chip>
                ) : (
                  <Chip tone="warning">{t("status.waitingChip")}</Chip>
                )}
              </div>
              <p className={styles.muted}>
                {zalo.keyHint ? t("status.keyHint", { hint: zalo.keyHint }) : t("status.keySaved")}
              </p>
              <p className={styles.state} role="status">
                {zalo.connected
                  ? zalo.linkedAt
                    ? t("status.connectedSince", {
                        date: format.dateTime(new Date(zalo.linkedAt), {
                          day: "numeric",
                          month: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      })
                    : t("status.connected")
                  : t("status.waiting")}
              </p>
              {!zalo.webhookOk && <p className={styles.warning}>{t("status.webhookProblem")}</p>}
              {!closed &&
                (confirming ? (
                  <div role="alertdialog" aria-label={t("remove.title")} className={styles.confirm}>
                    <p>{t("remove.confirm")}</p>
                    <div className={styles.buttons}>
                      <Button onClick={onRemove} disabled={busy}>
                        {busy ? t("remove.removing") : t("remove.yes")}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setConfirming(false)}
                        disabled={busy}
                      >
                        {t("remove.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setConfirming(true);
                      setFailure(null);
                    }}
                  >
                    {t("remove.title")}
                  </Button>
                ))}
            </div>
          ) : (
            <p className={styles.muted}>{t("status.none")}</p>
          )}
        </div>
      </section>

      {zalo && (
        <ZaloSwitchesPanel tournamentId={tournamentId} initial={zalo.switches} readOnly={closed} />
      )}

      <section aria-labelledby="zalo-steps-title" className={styles.panel}>
        <SectionHeader id="zalo-steps-title">{t("steps.title")}</SectionHeader>
        <div className={styles.body}>
          <ol className={styles.steps}>
            {STEPS.map((step, i) => (
              <li key={step} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {i + 1}
                </span>
                <span className={styles.stepText}>
                  <strong>{t(`steps.${step}.title`)}</strong>
                  <span>{t(`steps.${step}.body`)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="zalo-key-title" className={styles.panel}>
        <SectionHeader id="zalo-key-title">
          {zalo ? t("key.replaceTitle") : t("key.title")}
        </SectionHeader>
        <form className={styles.body} onSubmit={onSave} noValidate>
          <Field
            id="zalo-key"
            name="zaloKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            label={t("key.label")}
            hint={t("key.hint")}
            value={key}
            maxLength={200}
            disabled={readOnly || busy}
            onChange={(e) => {
              setKey(e.target.value);
              setFailure(null);
              setSaved(false);
            }}
          />
          <Button type="submit" variant="primary" block disabled={readOnly || busy || !key.trim()}>
            {busy && key ? t("key.saving") : t("key.save")}
          </Button>
          {closed && <p className={styles.muted}>{t("closed")}</p>}
          {saved && (
            <p role="status" className={styles.saved}>
              {t("key.saved")}
            </p>
          )}
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
        </form>
      </section>
    </>
  );
}
