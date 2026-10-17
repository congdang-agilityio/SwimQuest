import { useTranslations } from "next-intl";
import { ReportButton } from "@/components/reports/report-button";
import { TournamentBanner } from "@/components/tournaments/tournament-banner";
import { Chip, type ChipTone } from "@/components/ui";
import type { TournamentStatus } from "@/lib/tournaments/lifecycle";
import { imageSrc } from "@/lib/profile-avatar";
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
  /** Set to show "Report" (not for the organizer): the tournament id. */
  reportTournamentId?: string;
  name: string;
  /** Uploaded banner image; without it the template shows. */
  bannerImageId?: string | null;
  /** Uploaded logo, shown beside the status. */
  logoImageId?: string | null;
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
  const logo = imageSrc(props.logoImageId);
  const km = Number((props.routeDistanceM / 1000).toFixed(3));
  return (
    <>
      <TournamentBanner
        name={props.name}
        bannerImageId={props.bannerImageId}
        headingId="details-name"
      />
      <div className={styles.head}>
        <div className={styles.chips}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- organizer upload, served by the images API
            <img src={logo} alt="" className={styles.logo} />
          )}
          <Chip tone={STATUS_TONE[props.status]}>{t(`status.${props.status}`)}</Chip>
        </div>
        {props.description && <p className={styles.description}>{props.description}</p>}
        {props.reportTournamentId && (
          <ReportButton targetType="TOURNAMENT" targetId={props.reportTournamentId} />
        )}
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
