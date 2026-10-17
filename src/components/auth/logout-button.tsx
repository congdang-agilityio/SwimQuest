"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { clearAppCaches } from "@/components/pwa/sw-register";

const tap = { minHeight: 44, minWidth: 44 } as const;

/**
 * Ends the session, clears the app caches so the next person on this device starts clean, then
 * replaces the location so Back cannot show protected content.
 */
export function LogoutButton({ block = false }: { block?: boolean }) {
  const t = useTranslations("auth");
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");

  async function onClick() {
    setState("busy");
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        await clearAppCaches();
        return window.location.replace("/login");
      }
    } catch {}
    setState("failed");
  }

  return (
    <>
      {block ? (
        <Button variant="ghost" block onClick={onClick} disabled={state === "busy"}>
          {t("logout.button")}
        </Button>
      ) : (
        <button type="button" onClick={onClick} disabled={state === "busy"} style={tap}>
          {t("logout.button")}
        </button>
      )}
      {state === "failed" && <span role="alert">{t("errors.GENERIC")}</span>}
    </>
  );
}
