"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Avatar, Button, Chip, SectionHeader, SelectField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./unassigned-players.module.css";

export type UnassignedPlayerRow = {
  id: string;
  displayName: string;
  removedAfterStart: boolean;
};

export type TeamOption = { id: string; name: string; free: number };

type Props = { players: readonly UnassignedPlayerRow[]; teams: readonly TeamOption[] };

type Failure = "full" | "already" | "failed" | "network";

/** "Players without a team" on the organizer page: each row can be added to a team with room (S-42). */
export function UnassignedPlayers({ players, teams }: Props) {
  const t = useTranslations("organizer.players");
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [teamId, setTeamId] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const inFlight = useRef(false);

  function toggle(id: string) {
    setOpen(open === id ? null : id);
    setTeamId("");
    setFailure(null);
  }

  async function add(userId: string) {
    if (!teamId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailure(null);
    try {
      const res = await clientFetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      }).catch(() => null);
      if (!res) {
        setFailure("network");
      } else if (res.status === 201) {
        setOpen(null);
        setTeamId("");
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        const code: unknown = body?.error?.code;
        setFailure(
          code === "TEAM_FULL" ? "full" : code === "ALREADY_MEMBER" ? "already" : "failed",
        );
        if (code === "ALREADY_MEMBER") router.refresh();
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="unassigned-title" className={styles.panel}>
      <SectionHeader id="unassigned-title">{t("title")}</SectionHeader>
      <div className={styles.body}>
        {players.length === 0 ? (
          <p className={styles.empty}>{t("empty")}</p>
        ) : (
          <ul className={styles.list}>
            {players.map((p) => (
              <li key={p.id} className={styles.row}>
                <div className={styles.line}>
                  <Avatar name={p.displayName} decorative />
                  <span className={styles.name}>
                    {p.displayName}
                    {p.removedAfterStart && <Chip tone="warning">{t("removed")}</Chip>}
                  </span>
                  <Button
                    variant="secondary"
                    aria-expanded={open === p.id}
                    onClick={() => toggle(p.id)}
                  >
                    {t("add")}
                  </Button>
                </div>
                {open === p.id && (
                  <div
                    role="group"
                    aria-label={t("addFor", { name: p.displayName })}
                    className={styles.picker}
                  >
                    <SelectField
                      id={`team-${p.id}`}
                      label={t("team")}
                      value={teamId}
                      onChange={(e) => {
                        setTeamId(e.target.value);
                        setFailure(null);
                      }}
                    >
                      <option value="">{t("choose")}</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id} disabled={team.free <= 0}>
                          {team.free > 0
                            ? t("freePlaces", { name: team.name, count: team.free })
                            : t("teamFull", { name: team.name })}
                        </option>
                      ))}
                    </SelectField>
                    <div className={styles.buttons}>
                      <Button onClick={() => add(p.id)} disabled={!teamId || busy}>
                        {busy ? t("adding") : t("confirm")}
                      </Button>
                      <Button variant="secondary" onClick={() => toggle(p.id)} disabled={busy}>
                        {t("cancel")}
                      </Button>
                    </div>
                    {failure && (
                      <p role="alert" className={styles.error}>
                        {t(`errors.${failure}`)}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
