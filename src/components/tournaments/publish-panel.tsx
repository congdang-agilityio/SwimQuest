"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { clientFetch } from "@/lib/http/client-fetch";

type Issue = { code: string; field: string };

const touch = { minHeight: 44, minWidth: 44, boxSizing: "border-box", padding: 8 } as const;
const errorColor = { color: "#b91c1c" };
const KNOWN = [
  "SEASON_END_NOT_AFTER_START",
  "REALISTIC_LIMITS_OUT_OF_BOUNDS",
  "ROUTE_MISSING",
  "ROUTE_DISTANCE_INVALID",
  "NO_TEAM",
];

/** Where on the organizer page an issue's field lives: the team list, else the season details. */
export const issueHref = (field: string) => (field === "teams" ? "#teams-title" : "#season");

/** Draft-only controls on the organizer page: Preview link and a confirmed, single-flight Publish. */
export function PublishPanel({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations("publish.panel");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<"network" | "failed" | null>(null);
  const inFlight = useRef(false); // blocks a second click before React re-renders

  async function publish() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setIssues([]);
    setError(null);
    try {
      const res = await clientFetch(`/api/tournaments/${tournamentId}/publish`, {
        method: "POST",
      }).catch(() => null);
      if (!res) {
        setError("network");
      } else if (res.ok) {
        setConfirming(false);
        router.refresh();
      } else if (res.status === 422) {
        const body = await res.json().catch(() => null);
        const list: unknown = body?.error?.issues;
        const valid = Array.isArray(list)
          ? list.filter(
              (i): i is Issue => typeof i?.code === "string" && typeof i?.field === "string",
            )
          : [];
        setIssues(valid);
        if (valid.length === 0) setError("failed");
        setConfirming(false);
      } else {
        setError("failed");
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="publish-title">
      <h2 id="publish-title">{t("title")}</h2>
      <Link
        href={`/tournaments/${tournamentId}/manage/preview`}
        style={{ ...touch, display: "inline-block" }}
      >
        {t("preview")}
      </Link>{" "}
      {confirming ? (
        <span role="alertdialog" aria-label={t("publish")}>
          {t("confirm")}{" "}
          <button type="button" onClick={publish} disabled={busy} style={touch}>
            {busy ? t("publishing") : t("confirmYes")}
          </button>{" "}
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} style={touch}>
            {t("cancel")}
          </button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} style={touch}>
          {t("publish")}
        </button>
      )}
      {issues.length > 0 && (
        <div role="alert" style={errorColor}>
          <p>{t("fixTitle")}</p>
          <ul>
            {issues.map((i, n) => (
              <li key={`${i.code}-${i.field}-${n}`}>
                <a href={issueHref(i.field)}>
                  {t(`issues.${KNOWN.includes(i.code) ? i.code : "UNKNOWN"}`)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" style={errorColor}>
          {error === "network" ? t("networkError") : t("failed")}
        </p>
      )}
    </section>
  );
}
