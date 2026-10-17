"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { clientFetch } from "@/lib/http/client-fetch";
import type { TournamentSwitcherData } from "@/server/home/selected-tournament";
import styles from "./tournament-switcher.module.css";

type Props = TournamentSwitcherData & {
  /** "page": top of My Team / Voyage on phones. "rail": left navigation from 768 px. */
  placement: "page" | "rail";
};

/**
 * Picks which tournament My Team and Voyage show. A native select sits over the dropdown pill, so
 * it is keyboard and screen-reader operable. Rendered only for players in two or more tournaments.
 */
export function TournamentSwitcher({ selectedId, options, placement }: Props) {
  const t = useTranslations("nav.switcher");
  const router = useRouter();
  const [value, setValue] = useState(selectedId);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const current = options.find((o) => o.id === value) ?? options[0];

  async function choose(id: string) {
    const previous = value;
    setValue(id);
    setFailed(false);
    try {
      const res = await clientFetch("/api/me/selected-tournament", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tournamentId: id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      startTransition(() => router.refresh());
    } catch {
      setValue(previous);
      setFailed(true);
    }
  }

  return (
    <div
      className={`${styles.switcher} ${placement === "rail" ? styles.rail : styles.page}`}
      data-testid={`tournament-switcher-${placement}`}
      aria-busy={pending}
    >
      <div className={styles.pill}>
        <span className={styles.text}>
          <span className={styles.kicker}>{t("kicker")}</span>
          <strong className={styles.name}>{current.tournamentName}</strong>
          <span className={styles.team}>{current.teamName}</span>
        </span>
        <span className={styles.chevron} aria-hidden="true" />
        <select
          className={styles.select}
          aria-label={t("label")}
          value={value}
          onChange={(e) => void choose(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.tournamentName} · {o.teamName}
            </option>
          ))}
        </select>
      </div>
      {failed && (
        <p role="alert" className={styles.error}>
          {t("error")}
        </p>
      )}
    </div>
  );
}
