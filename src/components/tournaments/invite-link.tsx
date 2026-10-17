"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, SectionHeader, controlClass } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./manage.module.css";

/** Copies text with the Clipboard API, falling back to a hidden textarea and `execCommand`. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  const area = document.createElement("textarea");
  try {
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

type LinkState = { inviteEnabled: boolean; inviteUrl: string };

/** The tournament's invite link with Copy, Share, Switch off/on and a confirmed Replace. */
export function InviteLink({
  tournamentId,
  url,
  enabled,
  tournamentName,
}: {
  tournamentId: string;
  url: string;
  enabled: boolean;
  tournamentName: string;
}) {
  const t = useTranslations("publish.invite");
  const [link, setLink] = useState<LinkState>({ inviteEnabled: enabled, inviteUrl: url });
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false); // blocks a second click before React re-renders
  const input = useRef<HTMLInputElement>(null);
  // Detected after mount: the server HTML never has Share, so hydration always matches.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  async function copy() {
    const ok = await copyText(link.inviteUrl);
    if (!ok) input.current?.select();
    setState(ok ? "copied" : "failed");
  }

  async function share() {
    try {
      await navigator.share({
        title: tournamentName,
        text: t("shareText", { name: tournamentName }),
        url: link.inviteUrl,
      });
    } catch {
      // the user closed the share sheet: nothing to do
    }
  }

  /** PATCH (switch) or POST (replace) the link; shows the result the server returns. */
  async function change(init: RequestInit) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(false);
    try {
      const res = await clientFetch(`/api/tournaments/${tournamentId}/invite-link`, init).catch(
        () => null,
      );
      const body = res?.ok ? ((await res.json().catch(() => null)) as LinkState | null) : null;
      if (body && typeof body.inviteUrl === "string") {
        setLink({ inviteEnabled: body.inviteEnabled, inviteUrl: body.inviteUrl });
        setConfirming(false);
        setState("idle");
      } else {
        setError(true);
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const switchLink = () =>
    change({
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !link.inviteEnabled }),
    });

  return (
    <section aria-labelledby="invite-title" className={styles.panel}>
      <SectionHeader id="invite-title">{t("title")}</SectionHeader>
      <div className={styles.panelBody}>
        <p className={styles.hint}>{link.inviteEnabled ? t("hint") : t("offHint")}</p>
        <input
          ref={input}
          type="text"
          readOnly
          value={link.inviteUrl}
          aria-label={t("label")}
          className={`${controlClass} ${styles.inviteField}`}
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className={styles.actions}>
          <Button onClick={copy} disabled={busy}>
            {t("copy")}
          </Button>
          {canShare && (
            <Button variant="secondary" onClick={share} disabled={busy}>
              {t("share")}
            </Button>
          )}
        </div>
        {confirming ? (
          <div role="alertdialog" aria-label={t("replace")} className={styles.confirm}>
            <span>{t("replaceConfirm")}</span>
            <span className={styles.actions}>
              <Button onClick={() => change({ method: "POST" })} disabled={busy}>
                {busy ? t("replacing") : t("replaceYes")}
              </Button>
              <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
                {t("cancel")}
              </Button>
            </span>
          </div>
        ) : (
          <div className={styles.actions}>
            <Button variant="secondary" onClick={switchLink} disabled={busy}>
              {link.inviteEnabled ? t("switchOff") : t("switchOn")}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(true)} disabled={busy}>
              {t("replace")}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {t("changeFailed")}
          </p>
        )}
        <p
          role="status"
          className={[styles.status, state === "failed" && styles.statusFailed]
            .filter(Boolean)
            .join(" ")}
        >
          {state === "copied" && t("copied")}
          {state === "failed" && t("copyFailed")}
        </p>
      </div>
    </section>
  );
}
