"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const tap = { minHeight: 44, minWidth: 44 } as const;

/** Ends the session, then replaces the location so Back cannot show protected content. */
export function LogoutButton() {
  const t = useTranslations("auth");
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function onClick() {
    setState("busy");
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) return window.location.replace("/login");
    } catch {}
    setState("failed");
  }

  return (
    <>
      <button type="button" onClick={onClick} disabled={state === "busy"} style={tap}>
        {t("logout.button")}
      </button>
      {state === "failed" && <span role="alert">{t("errors.GENERIC")}</span>}
    </>
  );
}
