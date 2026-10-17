"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { copyText } from "@/components/tournaments/invite-link";
import { Button } from "@/components/ui";
import { reportTelemetry } from "@/lib/telemetry/report";
import styles from "./my-team.module.css";

/** "Mời thành viên": opens the team's invite link with Copy and (when supported) Share. */
export function InviteToTeam({
  url,
  teamName,
  teamId,
}: {
  url: string;
  teamName: string;
  teamId: string;
}) {
  const t = useTranslations("team.invite");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const input = useRef<HTMLInputElement>(null);
  // Detected after mount: the server HTML never has Share, so hydration always matches.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  /** Tells the server a captain shared the link; the server ignores anyone else. */
  function reportShare() {
    reportTelemetry(`invite:${teamId}`, { kind: "INVITE_SHARED", teamId });
  }

  async function copy() {
    const ok = await copyText(url);
    if (!ok) input.current?.select();
    setState(ok ? "copied" : "failed");
    if (ok) reportShare();
  }

  async function share() {
    try {
      await navigator.share({ title: teamName, text: t("shareText", { team: teamName }), url });
      reportShare();
    } catch {
      // the user closed the share sheet: nothing to do
    }
  }

  return (
    <section className={styles.invite} aria-labelledby="team-invite-title">
      <Button
        type="button"
        variant="secondary"
        block
        aria-expanded={open}
        aria-controls="team-invite-card"
        onClick={() => setOpen((v) => !v)}
      >
        {t("open")}
      </Button>
      {open && (
        <div id="team-invite-card" className={styles.inviteCard}>
          <h2 id="team-invite-title" className={styles.inviteTitle}>
            {t("title")}
          </h2>
          <p className={styles.inviteHint}>{t("hint")}</p>
          <input
            ref={input}
            type="text"
            readOnly
            value={url}
            aria-label={t("label")}
            className={styles.inviteInput}
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className={styles.inviteActions}>
            <Button type="button" variant="primary" onClick={copy}>
              {t("copy")}
            </Button>
            {canShare && (
              <Button type="button" variant="ghost" onClick={share}>
                {t("share")}
              </Button>
            )}
          </div>
          <p role="status" className={styles.inviteHint}>
            {state === "copied" && t("copied")}
            {state === "failed" && t("copyFailed")}
          </p>
        </div>
      )}
    </section>
  );
}
