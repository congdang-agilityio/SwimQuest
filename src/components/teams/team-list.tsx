"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { TeamEmblem } from "./team-emblem";
import { TeamForm } from "./team-form";
import { TeamStartStatus } from "./team-start-status";
import styles from "./team-setup.module.css";
import { Button, Chip, SectionHeader } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";

export type TeamRow = {
  id: string;
  name: string;
  emblemKey: string;
  description: string | null;
  memberLimit: number;
  memberCount: number;
  /** Message key of the chosen start, or null (only used with `startLock`). */
  startNameKey?: string | null;
  /** ISO instant the start was assigned automatically, or null (only used with `startLock`). */
  autoAssignedAtIso?: string | null;
};

type Props = {
  tournamentId: string;
  teams: readonly TeamRow[];
  capacity: number;
  /** Teams can be deleted only while the tournament is a draft. */
  isDraft: boolean;
  /** Shows each team's start and lock state; omitted for a draft. */
  startLock?: { locked: boolean; lockAtIso: string };
};

/** Organizer-only team management (rendered by the manage page, which enforces the role). */
export function TeamList({ tournamentId, teams, capacity, isDraft, startLock }: Props) {
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
    const res = await clientFetch(`/api/teams/${id}`, { method: "DELETE" }).catch(() => null);
    if (res?.status === 204) {
      setConfirming(null);
      router.refresh();
    } else {
      setDeleteFailed(true);
    }
  }

  return (
    <section aria-labelledby="teams-title" className={styles.manage}>
      <SectionHeader id="teams-title">{t("manage.title")}</SectionHeader>
      <div className={styles.manageBody}>
        <p className={styles.capacity}>
          <Chip tone="info">{t("manage.capacity", { count: capacity })}</Chip>
        </p>
        {teams.length === 0 && <p className={styles.empty}>{t("manage.empty")}</p>}
        <ul className={styles.rows}>
          {teams.map((team) => (
            <li key={team.id} className={editing === team.id ? undefined : styles.row}>
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
                  <TeamEmblem emblemKey={team.emblemKey} size={48} alt="" />
                  <span className={styles.rowInfo}>
                    <strong className={styles.rowName}>
                      <Link href={`/tournaments/${tournamentId}/manage/teams/${team.id}`}>
                        {team.name}
                      </Link>
                    </strong>
                    <span className={styles.rowMeta}>
                      <Chip>
                        {t("manage.members", { count: team.memberCount, limit: team.memberLimit })}
                      </Chip>
                      {startLock && (
                        <TeamStartStatus
                          startNameKey={team.startNameKey ?? null}
                          autoAssignedAtIso={team.autoAssignedAtIso ?? null}
                          {...startLock}
                        />
                      )}
                    </span>
                  </span>
                  <span className={styles.rowActions}>
                    <Button variant="secondary" size="sm" onClick={() => setEditing(team.id)}>
                      {t("manage.edit")}
                    </Button>
                    {isDraft && team.memberCount === 0 && confirming !== team.id && (
                      <Button variant="ghost" size="sm" onClick={() => setConfirming(team.id)}>
                        {t("manage.delete")}
                      </Button>
                    )}
                  </span>
                  {isDraft && team.memberCount === 0 && confirming === team.id && (
                    <span
                      role="alertdialog"
                      aria-label={t("manage.delete")}
                      className={styles.confirm}
                    >
                      <span>{t("manage.deleteConfirm", { name: team.name })}</span>
                      <span className={styles.confirmActions}>
                        <Button size="sm" onClick={() => remove(team.id)}>
                          {t("manage.deleteConfirmYes")}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setConfirming(null)}>
                          {t("manage.cancel")}
                        </Button>
                      </span>
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        {deleteFailed && (
          <p role="alert" className={styles.error}>
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
          <Button block onClick={() => setEditing("new")}>
            {t("manage.add")}
          </Button>
        )}
      </div>
    </section>
  );
}
