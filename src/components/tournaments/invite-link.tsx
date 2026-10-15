"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";

const touch = { minHeight: 44, minWidth: 44, boxSizing: "border-box", padding: 8 } as const;

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
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** The tournament's invite link with Copy and (when the device supports it) Share. */
export function InviteLink({ url, tournamentName }: { url: string; tournamentName: string }) {
  const t = useTranslations("publish.invite");
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const input = useRef<HTMLInputElement>(null);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

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
    <section aria-labelledby="invite-title">
      <h2 id="invite-title">{t("title")}</h2>
      <p>{t("hint")}</p>
      <input
        ref={input}
        type="text"
        readOnly
        value={url}
        aria-label={t("label")}
        style={{ ...touch, width: "100%" }}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" onClick={copy} style={touch}>
        {t("copy")}
      </button>{" "}
      {canShare && (
        <button type="button" onClick={share} style={touch}>
          {t("share")}
        </button>
      )}
      <p role="status">
        {state === "copied" && t("copied")}
        {state === "failed" && t("copyFailed")}
      </p>
    </section>
  );
}
