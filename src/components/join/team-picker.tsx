"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MockupPicture } from "@/components/art/mockup-picture";
import { TeamEmblem } from "@/components/teams/team-emblem";
import { Button, ButtonLink, Card, Chip } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./join.module.css";

export type PickerTeam = {
  id: string;
  name: string;
  emblemKey: string;
  freePlaces: number;
};

type Props = {
  /** Endpoint that takes `{teamId}`: /api/join/:token or /api/tournaments/:id/join. */
  submitUrl: string;
  teams: readonly PickerTeam[];
  myTeam: { id: string; name: string } | null;
  /** Team named by the link (?team=), already checked to belong to this tournament. */
  preselectedId?: string | null;
};

/** Team choice on the join page: join at once (POST to submitUrl), or show the current team. */
export function TeamPicker({ submitUrl, teams, myTeam, preselectedId = null }: Props) {
  const t = useTranslations("join");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<"justFilled" | "notPublic" | "failed" | null>(null);

  const [chosenId, setChosenId] = useState<string | null>(preselectedId);
  const chosen = teams.find((x) => x.id === chosenId) ?? null;
  const chosenFull = chosen !== null && chosen.freePlaces <= 0;

  if (myTeam) {
    return (
      <Card as="section" className={styles.notice}>
        <MockupPicture artKey="map/flag" alt="" className={styles.noticeArt} />
        <p>{t("alreadyIn", { team: myTeam.name })}</p>
        <ButtonLink href="/team" block>
          {t("goToTeam")}
        </ButtonLink>
      </Card>
    );
  }

  async function choose(teamId: string) {
    setChosenId(teamId);
    setBusy(true);
    const res = await clientFetch(submitUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ teamId, ...(teamId === preselectedId ? { fromTeamLink: true } : {}) }),
    }).catch(() => null);
    if (res?.ok) return router.push("/team");
    setBusy(false);
    const body = res ? await res.json().catch(() => null) : null;
    if (res?.status === 409 && body?.error?.code === "TEAM_FULL") setMessage("justFilled");
    else if (res?.status === 404 && body?.error?.code === "NOT_PUBLIC") setMessage("notPublic");
    else setMessage("failed");
    router.refresh();
  }

  return (
    <section aria-labelledby="pick-title" className={styles.picker}>
      <h2 id="pick-title" className={styles.pickTitle}>
        {t("chooseTeam")}
      </h2>
      {message && (
        <p role="alert" className={styles.alert}>
          {t(message)}
        </p>
      )}
      {!message && chosen && chosenFull && (
        <p role="status" className={styles.alert}>
          {t("linkTeamFull", { name: chosen.name })}
        </p>
      )}
      <ul className={styles.teamList}>
        {teams.map((team) => {
          const full = team.freePlaces <= 0;
          const selected = team.id === chosenId && !full;
          return (
            <li
              key={team.id}
              aria-current={selected ? "true" : undefined}
              className={[styles.teamRow, full && styles.teamRowFull].filter(Boolean).join(" ")}
            >
              <TeamEmblem emblemKey={team.emblemKey} size={48} alt="" />
              <span className={styles.teamInfo}>
                <strong className={styles.teamName}>{team.name}</strong>
                <span className={styles.chips}>
                  <Chip tone={full ? "neutral" : "info"}>
                    {full ? t("full") : t("placesLeft", { count: team.freePlaces })}
                  </Chip>
                  {selected && <Chip tone="success">{t("selected")}</Chip>}
                </span>
              </span>
              <Button
                size="sm"
                variant={full ? "secondary" : "primary"}
                disabled={busy || full}
                onClick={() => choose(team.id)}
                className={styles.joinButton}
              >
                {full ? t("fullDisabled") : t("join", { name: team.name })}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
