"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TeamEmblem } from "./team-emblem";
import { TeamForm } from "./team-form";

export type TeamRow = {
  id: string;
  name: string;
  emblemKey: string;
  description: string | null;
  memberLimit: number;
  memberCount: number;
};

type Props = {
  tournamentId: string;
  teams: readonly TeamRow[];
  capacity: number;
  /** Teams can be deleted only while the tournament is a draft. */
  isDraft: boolean;
};

const touch = { minHeight: 44, minWidth: 44, boxSizing: "border-box", padding: 8 } as const;
const errorColor = { color: "#b91c1c" };

/** Organizer-only team management (rendered by the manage page, which enforces the role). */
export function TeamList({ tournamentId, teams, capacity, isDraft }: Props) {
  const t = useTranslations("teams");
  const router = useRouter();
  // "new", a team id being edited, or null.
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  function saved() {
    setEditing(null);
    router.refresh();
  }

  async function remove(id: string) {
    setDeleteFailed(false);
    const res = await fetch(`/api/teams/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.status === 204) {
      setConfirming(null);
      router.refresh();
    } else {
      setDeleteFailed(true);
    }
  }

  return (
    <section aria-labelledby="teams-title">
      <h2 id="teams-title">{t("manage.title")}</h2>
      <p>{t("manage.capacity", { count: capacity })}</p>
      {teams.length === 0 && <p>{t("manage.empty")}</p>}
      <ul>
        {teams.map((team) => (
          <li key={team.id}>
            {editing === team.id ? (
              <TeamForm
                action={{ method: "PATCH", url: `/api/teams/${team.id}` }}
                initial={{
                  name: team.name,
                  emblemKey: team.emblemKey,
                  description: team.description ?? "",
                  memberLimit: team.memberLimit,
                }}
                onSaved={saved}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <>
                <TeamEmblem emblemKey={team.emblemKey} size={32} alt="" />{" "}
                <strong>
                  <Link
                    href={`/tournaments/${tournamentId}/manage/teams/${team.id}`}
                    style={{ ...touch, display: "inline-block" }}
                  >
                    {team.name}
                  </Link>
                </strong>{" "}
                <span>
                  {t("manage.members", { count: team.memberCount, limit: team.memberLimit })}
                </span>{" "}
                <button type="button" onClick={() => setEditing(team.id)} style={touch}>
                  {t("manage.edit")}
                </button>
                {isDraft && team.memberCount === 0 && (
                  <>
                    {" "}
                    {confirming === team.id ? (
                      <span role="alertdialog" aria-label={t("manage.delete")}>
                        {t("manage.deleteConfirm", { name: team.name })}{" "}
                        <button type="button" onClick={() => remove(team.id)} style={touch}>
                          {t("manage.deleteConfirmYes")}
                        </button>{" "}
                        <button type="button" onClick={() => setConfirming(null)} style={touch}>
                          {t("manage.cancel")}
                        </button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirming(team.id)} style={touch}>
                        {t("manage.delete")}
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {deleteFailed && (
        <p role="alert" style={errorColor}>
          {t("manage.deleteFailed")}
        </p>
      )}
      {editing === "new" ? (
        <TeamForm
          action={{ method: "POST", url: `/api/tournaments/${tournamentId}/teams` }}
          onSaved={saved}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button type="button" onClick={() => setEditing("new")} style={touch}>
          {t("manage.add")}
        </button>
      )}
    </section>
  );
}
