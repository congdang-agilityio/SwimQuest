import { useTranslations } from "next-intl";
import { MockupPicture } from "@/components/art/mockup-picture";
import { Chip, type ChipTone } from "@/components/ui";
import type { TournamentStatus } from "@/lib/tournaments/lifecycle";
import { formatVnDateTime } from "@/lib/time/vn";
import styles from "./details.module.css";

const STATUS_TONE: Record<TournamentStatus, ChipTone> = {
  DRAFT: "neutral",
  PUBLISHED: "info",
  ACTIVE: "success",
  COMPLETED: "gold",
  ARCHIVED: "neutral",
};

type Props = {
  name: string;
  description: string;
  organizerName: string;
  status: TournamentStatus;
  seasonStartAt: Date;
  seasonEndAt: Date;
  routeId: string;
  routeDistanceM: number;
};

/** Banner, name, status, description and the key facts of a tournament. Organizer text shows as typed. */
export function DetailsHeader(props: Props) {
  const t = useTranslations("details");
  const r = useTranslations("routes");
  const when = (value: Date) => formatVnDateTime(new Date(value));
  const km = Number((props.routeDistanceM / 1000).toFixed(3));
  return (
    <>
      <MockupPicture
        artKey="scenes/sea-ly-son-16x9"
        alt=""
        className={styles.hero}
        eager
        fallback={<div className={styles.heroFallback} />}
      />
      <div className={styles.head}>
        <h2 id="details-name" className={styles.name}>
          {props.name}
        </h2>
        <div className={styles.chips}>
          <Chip tone={STATUS_TONE[props.status]}>{t(`status.${props.status}`)}</Chip>
        </div>
        {props.description && <p className={styles.description}>{props.description}</p>}
      </div>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>{t("organizer")}</dt>
          <dd>{props.organizerName}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t("seasonStart")}</dt>
          <dd>{when(props.seasonStartAt)}</dd>
        </div>
        <div className={styles.fact}>
          <dt>{t("seasonEnd")}</dt>
          <dd>
            {when(props.seasonEndAt)}
            <span className={styles.note}>{t("vietnamTime")}</span>
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>{t("route")}</dt>
          <dd>
            {r(`${props.routeId}.name`)}, {t("distance", { km })}
          </dd>
        </div>
      </dl>
    </>
  );
}
