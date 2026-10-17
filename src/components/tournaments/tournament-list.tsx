"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MockupPicture } from "@/components/art/mockup-picture";
import { ButtonLink, Chip, Tabs, type ChipTone } from "@/components/ui";
import type { TournamentStatus } from "@/lib/tournaments/lifecycle";
import { utcToVnParts } from "@/lib/time/vn";
import type { MyTournament } from "@/server/home/my-tournaments";
import styles from "./tournament-list.module.css";

type Filter = "all" | "active" | "upcoming" | "ended";
const FILTERS: readonly Filter[] = ["all", "active", "upcoming", "ended"];
const FILTER_STATUSES: Record<Exclude<Filter, "all">, readonly TournamentStatus[]> = {
  active: ["ACTIVE"],
  upcoming: ["DRAFT", "PUBLISHED"],
  ended: ["COMPLETED", "ARCHIVED"],
};

const STATUS_TONE: Record<TournamentStatus, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "info",
  ACTIVE: "success",
  COMPLETED: "gold",
  ARCHIVED: "neutral",
};

/** Scene thumbnails from the G1 art registry (#703), echoing the mockup's coastal pictures. */
const THUMB_KEYS = [
  "scenes/sea-island-day-4x3",
  "scenes/beach-da-nang-4x3",
  "scenes/sea-cu-lao-cham-4x3",
  "scenes/sea-ly-son-4x3",
  "scenes/sunrise-coast-4x3",
] as const;

/** dd/mm/yyyy in Vietnam time. */
function vnDate(d: Date): string {
  const [y, m, day] = utcToVnParts(new Date(d)).date.split("-");
  return `${day}/${m}/${y}`;
}

/** My tournaments as mockup card rows, with a client-side status filter. */
export function TournamentList({ tournaments }: { tournaments: readonly MyTournament[] }) {
  const t = useTranslations("tabs.tournaments");
  const [filter, setFilter] = useState<Filter>("all");
  // The thumbnail follows the row's place in the full list, so filtering keeps each picture.
  const rows = tournaments.map((x, i) => ({ ...x, thumbKey: THUMB_KEYS[i % THUMB_KEYS.length] }));
  const shown =
    filter === "all"
      ? rows
      : rows.filter((x) => FILTER_STATUSES[filter].includes(x.effectiveStatus));

  return (
    <div className={styles.list}>
      <div className={styles.filters}>
        <Tabs
          label={t("filterLabel")}
          value={filter}
          onChange={(id) => setFilter(id as Filter)}
          items={FILTERS.map((id) => ({ id, label: t(`filter.${id}`) }))}
        />
      </div>
      {shown.length === 0 ? (
        <p className={styles.empty}>{t("filterEmpty")}</p>
      ) : (
        <ul className={styles.rows}>
          {shown.map((x) => (
            <li key={x.id} className={styles.row}>
              <MockupPicture
                artKey={x.thumbKey}
                alt=""
                className={styles.thumb}
                fallback={<span className={styles.thumb} aria-hidden="true" />}
              />
              <div className={styles.body}>
                <h3 className={styles.name}>{x.name}</h3>
                <p className={styles.dates}>
                  {t("dates", { start: vnDate(x.seasonStartAt), end: vnDate(x.seasonEndAt) })}
                </p>
                {x.team ? <p className={styles.team}>{t("team", { name: x.team.name })}</p> : null}
                <div className={styles.footer}>
                  <div className={styles.chips}>
                    <Chip tone={STATUS_TONE[x.effectiveStatus]}>
                      {t(`status.${x.effectiveStatus}`)}
                    </Chip>
                    {x.isOrganizer ? <Chip tone="gold">{t("organizer")}</Chip> : null}
                  </div>
                  <ButtonLink
                    size="sm"
                    variant={x.isOrganizer ? "primary" : "secondary"}
                    href={
                      x.isOrganizer
                        ? `/tournaments/${x.id}/manage`
                        : `/tournaments/${x.id}/leaderboard`
                    }
                    className={styles.action}
                  >
                    {x.isOrganizer ? t("manage") : t("details")}
                    <span className={styles.visuallyHidden}>: {x.name}</span>
                  </ButtonLink>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
