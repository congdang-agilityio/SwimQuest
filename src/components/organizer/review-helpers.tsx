"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar, Button, Card, SectionHeader, SelectField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./review-helpers.module.css";

export type HelperRow = { userId: string; displayName: string };

type Props = {
  tournamentId: string;
  tournamentName: string;
  helpers: readonly HelperRow[];
  players: readonly HelperRow[];
};

type Failure = "notPlayer" | "already" | "notHelper" | "failed" | "network";

const CODES: Record<string, Failure> = {
  NOT_A_PLAYER: "notPlayer",
  ALREADY_HELPER: "already",
  NOT_A_HELPER: "notHelper",
};

/** "Review helpers" page body: the helper list, a player picker and a confirmed removal (S-45). */
export function ReviewHelpers({ tournamentId, tournamentName, helpers, players }: Props) {
  const t = useTranslations("helpers");
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const inFlight = useRef(false);

  async function send(method: "POST" | "DELETE", id: string, done: () => void) {
    if (!id || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const res = await clientFetch(`/api/tournaments/${tournamentId}/review-helpers`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: id }),
      }).catch(() => null);
      if (!res) {
        setFailure("network");
      } else if (res.ok) {
        done();
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        const code: unknown = body?.error?.code;
        setFailure((typeof code === "string" && CODES[code]) || "failed");
        // The list is stale when the other side already changed it.
        if (code === "ALREADY_HELPER" || code === "NOT_A_HELPER") router.refresh();
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Card className={styles.note}>
        <p>
          <strong>{tournamentName}</strong>
        </p>
        <p>{t("note")}</p>
      </Card>
      <section aria-labelledby="helpers-list-title" className={styles.panel}>
        <SectionHeader id="helpers-list-title">{t("listTitle")}</SectionHeader>
        <div className={styles.body}>
          {helpers.length === 0 ? (
            <p className={styles.empty}>{t("empty")}</p>
          ) : (
            <ul className={styles.list}>
              {helpers.map((h) => (
                <li key={h.userId} className={styles.row}>
                  <div className={styles.line}>
                    <Avatar name={h.displayName} decorative />
                    <span className={styles.name}>{h.displayName}</span>
                    <Button
                      variant="secondary"
                      aria-label={t("removeFor", { name: h.displayName })}
                      onClick={() => {
                        setRemoving(h.userId);
                        setFailure(null);
                      }}
                    >
                      {t("remove")}
                    </Button>
                  </div>
                  {removing === h.userId && (
                    <div
                      role="alertdialog"
                      aria-label={t("removeFor", { name: h.displayName })}
                      className={styles.confirm}
                    >
                      <span>{t("removeConfirm", { name: h.displayName })}</span>
                      <div className={styles.buttons}>
                        <Button
                          onClick={() => send("DELETE", h.userId, () => setRemoving(null))}
                          disabled={busy}
                        >
                          {busy ? t("removing") : t("removeYes")}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setRemoving(null)}
                          disabled={busy}
                        >
                          {t("cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section aria-labelledby="helpers-add-title" className={styles.panel}>
        <SectionHeader id="helpers-add-title">{t("addTitle")}</SectionHeader>
        <div className={styles.body}>
          {players.length === 0 ? (
            <p className={styles.empty}>{t("noPlayers")}</p>
          ) : (
            <div className={styles.picker}>
              <SelectField
                id="helper-player"
                label={t("player")}
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setFailure(null);
                }}
              >
                <option value="">{t("choose")}</option>
                {players.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {p.displayName}
                  </option>
                ))}
              </SelectField>
              <Button
                onClick={() => send("POST", userId, () => setUserId(""))}
                disabled={!userId || busy}
              >
                {busy && removing === null ? t("appointing") : t("appoint")}
              </Button>
            </div>
          )}
          {failure && (
            <p role="alert" className={styles.error}>
              {t(`errors.${failure}`)}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
