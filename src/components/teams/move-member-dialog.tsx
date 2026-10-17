"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./move-member-dialog.module.css";
import { Button, SelectField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";

export type MoveTarget = { id: string; name: string; free: number };

type Props = { teamId: string; userId: string; name: string; targets: readonly MoveTarget[] };

/** Organizer's Move on a roster row: pick a team with room, confirm (POST .../move), refresh. */
export function MoveMemberDialog({ teamId, userId, name, targets }: Props) {
  const t = useTranslations("roster");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toTeamId, setToTeamId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const target = targets.find((x) => x.id === toTeamId);
  const hasRoom = targets.some((x) => x.free > 0);

  function close() {
    setOpen(false);
    setConfirming(false);
    setError(null);
    setToTeamId("");
  }

  async function move() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const res = await clientFetch(
        `/api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}/move`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ toTeamId }),
        },
      );
      if (res.ok) {
        setDone(t("done", { name, team: target.name }));
        close();
        router.refresh();
      } else {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        const code = body?.error?.code;
        setConfirming(false);
        if (code === "TEAM_FULL") {
          setError(t("errors.TEAM_FULL"));
          router.refresh();
        } else setError(t(res.status === 403 ? "errors.FORBIDDEN" : "errors.GENERIC"));
      }
    } catch {
      setConfirming(false);
      setError(t("errors.GENERIC"));
    }
    setBusy(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (target && target.free > 0) setConfirming(true);
  }

  if (!open) {
    return (
      <>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setDone(null);
            setOpen(true);
          }}
          aria-label={t("moveFor", { name })}
          style={{ minHeight: 44, minWidth: 44 }}
        >
          {t("move")}
        </Button>
        {done && <span role="status"> {done}</span>}
      </>
    );
  }

  const id = `move-${userId}`;
  return (
    <form onSubmit={onSubmit} noValidate className={styles.panel} aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className={styles.title}>
        {t("title", { name })}
      </p>
      {hasRoom ? (
        <SelectField
          id={id}
          label={t("target")}
          value={toTeamId}
          onChange={(e) => {
            setToTeamId(e.target.value);
            setConfirming(false);
            setError(null);
          }}
        >
          <option value="">{t("choose")}</option>
          {targets.map((x) => (
            <option key={x.id} value={x.id} disabled={x.free <= 0}>
              {x.name} ({x.free > 0 ? t("free", { count: x.free }) : t("full")})
            </option>
          ))}
        </SelectField>
      ) : (
        <p className={styles.note}>{t("noRoom")}</p>
      )}
      {error && (
        <p role="alert" className={styles.note}>
          {error}
        </p>
      )}
      {confirming && target ? (
        <div
          role="alertdialog"
          aria-label={t("confirmTitle", { name, team: target.name })}
          className={styles.confirm}
        >
          <p className={styles.confirmTitle}>{t("confirmTitle", { name, team: target.name })}</p>
          <p className={styles.confirmBody}>{t("confirmBody", { name, team: target.name })}</p>
          <div className={styles.actions}>
            <Button type="button" disabled={busy} onClick={() => void move()}>
              {t("confirm")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button type="submit" disabled={!target || target.free <= 0}>
            {t("next")}
          </Button>
          <Button type="button" variant="secondary" onClick={close}>
            {t("cancel")}
          </Button>
        </div>
      )}
    </form>
  );
}
