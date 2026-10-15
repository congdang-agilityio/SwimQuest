"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TeamEmblem } from "@/components/teams/team-emblem";

export type PickerTeam = {
  id: string;
  name: string;
  emblemKey: string;
  freePlaces: number;
};

type Props = {
  token: string;
  teams: readonly PickerTeam[];
  myTeam: { id: string; name: string } | null;
  /** Team named by the link (?team=), already checked to belong to this tournament. */
  preselectedId?: string | null;
};

const tap = { minHeight: 44, minWidth: 44, boxSizing: "border-box", padding: 8 } as const;

/** Team choice on the join page: join at once (POST /api/join/:token), or show the current team. */
export function TeamPicker({ token, teams, myTeam, preselectedId = null }: Props) {
  const t = useTranslations("join");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<"justFilled" | "failed" | null>(null);

  const [chosenId, setChosenId] = useState<string | null>(preselectedId);
  const chosen = teams.find((x) => x.id === chosenId) ?? null;
  const chosenFull = chosen !== null && chosen.freePlaces <= 0;

  if (myTeam) {
    return (
      <section>
        <p>{t("alreadyIn", { team: myTeam.name })}</p>
        <Link href="/team" style={{ ...tap, display: "inline-block" }}>
          {t("goToTeam")}
        </Link>
      </section>
    );
  }

  async function choose(teamId: string) {
    setChosenId(teamId);
    setBusy(true);
    const res = await fetch(`/api/join/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ teamId }),
    }).catch(() => null);
    if (res?.ok) return router.push("/team");
    setBusy(false);
    const body = res ? await res.json().catch(() => null) : null;
    if (res?.status === 409 && body?.error?.code === "TEAM_FULL") setMessage("justFilled");
    else setMessage("failed");
    router.refresh();
  }

  return (
    <section aria-labelledby="pick-title">
      <h2 id="pick-title">{t("chooseTeam")}</h2>
      {message && <p role="alert">{t(message)}</p>}
      {!message && chosen && chosenFull && (
        <p role="status">{t("linkTeamFull", { name: chosen.name })}</p>
      )}
      <ul>
        {teams.map((team) => {
          const full = team.freePlaces <= 0;
          const selected = team.id === chosenId && !full;
          return (
            <li key={team.id} aria-current={selected ? "true" : undefined}>
              <TeamEmblem emblemKey={team.emblemKey} size={32} alt="" />{" "}
              <strong>{team.name}</strong> {selected && <em>{t("selected")}</em>}{" "}
              <span>{full ? t("full") : t("placesLeft", { count: team.freePlaces })}</span>{" "}
              <button
                type="button"
                disabled={busy || full}
                onClick={() => choose(team.id)}
                style={tap}
              >
                {full ? t("fullDisabled") : t("join", { name: team.name })}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
