"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** Ends the session, then replaces the location so Back cannot show protected content. */
export function LogoutButton() {
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onClick() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        window.location.replace("/login");
        return;
      }
    } catch {
      // fall through to the error message
    }
    setFailed(true);
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        style={{ minHeight: 44, minWidth: 44 }}
      >
        {t("logout.button")}
      </button>
      {failed && (
        <span role="alert" style={{ color: "#b91c1c" }}>
          {t("errors.GENERIC")}
        </span>
      )}
    </>
  );
}
