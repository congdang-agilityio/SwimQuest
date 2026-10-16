"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { clientFetch } from "@/lib/http/client-fetch";

type Props = { teamId: string; userId: string; name: string };

/** Appoints this member as captain (PUT /api/teams/:teamId/captain), then refreshes the page. */
export function MakeCaptainButton({ teamId, userId, name }: Props) {
  const t = useTranslations("captain");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function appoint() {
    setBusy(true);
    setFailed(false);
    const res = await clientFetch(`/api/teams/${teamId}/captain`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) router.refresh();
    else setFailed(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={appoint}
        disabled={busy}
        aria-label={t("makeCaptainFor", { name })}
        style={{ minHeight: 44, minWidth: 44, boxSizing: "border-box", padding: 8 }}
      >
        {t("makeCaptain")}
      </button>
      {failed && (
        <span role="alert" style={{ color: "#b91c1c" }}>
          {" "}
          {t("failed")}
        </span>
      )}
    </>
  );
}
