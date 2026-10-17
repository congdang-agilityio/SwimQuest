"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import joinStyles from "@/components/join/join.module.css";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { Button, Chip } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./my-team.module.css";

export type SwitchTeam = { id: string; name: string; emblemKey: string; freePlaces: number };

type Props = {
  teamId: string;
  teamName: string;
  isCaptain: boolean;
  /** False from the season start on: only the organizer can move players then. */
  beforeStart: boolean;
  otherTeams: readonly SwitchTeam[];
};

type Step =
  { kind: "idle" } | { kind: "leave" } | { kind: "pick" } | { kind: "switch"; to: string };
type Failure = "seasonStarted" | "teamFull" | "alreadyMember" | "notMember" | "failed";

const CODES: Record<string, Failure> = {
  SEASON_STARTED: "seasonStarted",
  TEAM_FULL: "teamFull",
  ALREADY_MEMBER: "alreadyMember",
  NOT_A_MEMBER: "notMember",
};

/** Leave or switch team on My Team: before the start only, each behind an in-page confirm step. */
export function LeaveSwitchActions({
  teamId,
  teamName,
  isCaptain,
  beforeStart,
  otherTeams,
}: Props) {
  const t = useTranslations("team.leaveSwitch");
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  if (!beforeStart) {
    return <p className={`${styles.note} ${styles.afterStart}`}>{t("afterStart")}</p>;
  }

  async function send(path: string, body?: object, redirect?: string) {
    setBusy(true);
    setFailure(null);
    const res = await clientFetch(`/api/teams/${encodeURIComponent(teamId)}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }).catch(() => null);
    if (res?.ok) {
      setStep({ kind: "idle" });
      setBusy(false);
      if (redirect) router.push(redirect);
      else router.refresh();
      return;
    }
    const data = res ? await res.json().catch(() => null) : null;
    const code = typeof data?.error?.code === "string" ? data.error.code : "";
    setFailure(res?.status === 422 ? "failed" : (CODES[code] ?? "failed"));
    setBusy(false);
    router.refresh();
  }

  const target = step.kind === "switch" ? otherTeams.find((x) => x.id === step.to) : undefined;

  return (
    <section aria-label={t("title")} className={styles.moveActions}>
      {failure && (
        <p role="alert" className={joinStyles.alert}>
          {t(`error.${failure}`)}
        </p>
      )}

      {step.kind === "idle" && (
        <div className={styles.moveButtons}>
          <Button variant="secondary" onClick={() => setStep({ kind: "pick" })}>
            {t("switch")}
          </Button>
          <Button variant="ghost" onClick={() => setStep({ kind: "leave" })}>
            {t("leave")}
          </Button>
        </div>
      )}

      {step.kind === "leave" && (
        <div role="group" aria-label={t("leave")} className={styles.confirm}>
          <strong>{t("leaveTitle", { team: teamName })}</strong>
          <p className={styles.note}>{t("leaveBody")}</p>
          {isCaptain && (
            <p role="alert" className={joinStyles.alert}>
              {t("captainWarning")}
            </p>
          )}
          <div className={styles.moveButtons}>
            <Button variant="dark" disabled={busy} onClick={() => send("leave", undefined, "/")}>
              {t("confirmLeave")}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setStep({ kind: "idle" })}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {step.kind === "pick" && (
        <div className={joinStyles.picker}>
          <strong>{t("pickTitle")}</strong>
          {otherTeams.length === 0 ? (
            <p className={styles.note}>{t("noOtherTeams")}</p>
          ) : (
            <ul className={joinStyles.teamList}>
              {otherTeams.map((team) => {
                const full = team.freePlaces <= 0;
                return (
                  <li
                    key={team.id}
                    className={[joinStyles.teamRow, full && joinStyles.teamRowFull]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <TeamEmblem emblemKey={team.emblemKey} size={48} alt="" />
                    <span className={joinStyles.teamInfo}>
                      <strong className={joinStyles.teamName}>{team.name}</strong>
                      <span className={joinStyles.chips}>
                        <Chip tone={full ? "neutral" : "info"}>
                          {full ? t("full") : t("placesLeft", { count: team.freePlaces })}
                        </Chip>
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant={full ? "secondary" : "primary"}
                      disabled={full}
                      onClick={() => setStep({ kind: "switch", to: team.id })}
                      className={joinStyles.joinButton}
                    >
                      {full ? t("fullDisabled") : t("choose", { name: team.name })}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <Button variant="ghost" onClick={() => setStep({ kind: "idle" })}>
            {t("cancel")}
          </Button>
        </div>
      )}

      {step.kind === "switch" && target && (
        <div role="group" aria-label={t("switch")} className={styles.confirm}>
          <strong>{t("switchTitle", { team: target.name })}</strong>
          <p className={styles.note}>{t("switchBody")}</p>
          {isCaptain && (
            <p role="alert" className={joinStyles.alert}>
              {t("captainWarning")}
            </p>
          )}
          <div className={styles.moveButtons}>
            <Button disabled={busy} onClick={() => send("switch", { toTeamId: target.id })}>
              {t("confirmSwitch")}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setStep({ kind: "pick" })}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
