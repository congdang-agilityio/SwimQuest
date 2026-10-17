"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, SectionHeader, controlClass } from "@/components/ui";
import styles from "./manage.module.css";

/** Copies text with the Clipboard API, falling back to a hidden textarea and `execCommand`. */
async function copyText(text: string): Promise<boolean> {
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

/** The tournament's invite link with Copy and (when the device supports it) Share. */
export function InviteLink({ url, tournamentName }: { url: string; tournamentName: string }) {
  const t = useTranslations("publish.invite");
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const input = useRef<HTMLInputElement>(null);
  // Detected after mount: the server HTML never has Share, so hydration always matches.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  async function copy() {
    const ok = await copyText(url);
    if (!ok) input.current?.select();
    setState(ok ? "copied" : "failed");
  }

  async function share() {
    try {
      await navigator.share({
        title: tournamentName,
        text: t("shareText", { name: tournamentName }),
        url,
      });
    } catch {
      // the user closed the share sheet: nothing to do
    }
  }

  return (
    <section aria-labelledby="invite-title" className={styles.panel}>
      <SectionHeader id="invite-title">{t("title")}</SectionHeader>
      <div className={styles.panelBody}>
        <p className={styles.hint}>{t("hint")}</p>
        <input
          ref={input}
          type="text"
          readOnly
          value={url}
          aria-label={t("label")}
          className={`${controlClass} ${styles.inviteField}`}
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className={styles.actions}>
          <Button onClick={copy}>{t("copy")}</Button>
          {canShare && (
            <Button variant="secondary" onClick={share}>
              {t("share")}
            </Button>
          )}
        </div>
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
