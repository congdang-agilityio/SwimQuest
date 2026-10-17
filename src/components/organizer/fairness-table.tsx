import { useTranslations } from "next-intl";
import console from "./console.module.css";
import styles from "./metrics.module.css";
import { SectionHeader } from "@/components/ui";
import { formatProgressPct } from "@/lib/scoring/progress";
import type { Fairness, FairnessGroup } from "@/server/organizer/fairness";

type TableProps = {
  id: string;
  title: string;
  head: string;
  groups: readonly FairnessGroup[];
  label: (key: string) => string;
};

function GroupTable({ id, title, head, groups, label }: TableProps) {
  const t = useTranslations("metrics.fairness");
  return (
    <section aria-labelledby={id} className={console.section}>
      <SectionHeader id={id}>{title}</SectionHeader>
      <div className={`${console.sectionBody} ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{head}</th>
              <th scope="col" className={styles.num}>
                {t("teams")}
              </th>
              <th scope="col" className={styles.num}>
                {t("progress")}
              </th>
              <th scope="col" className={styles.num}>
                {t("finish")}
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key}>
                <th scope="row">{label(g.key)}</th>
                <td className={styles.num}>{g.teams}</td>
                <td className={styles.num}>{formatProgressPct(g.averageProgressBp)}</td>
                <td className={styles.num}>{t("progressValue", { pct: g.finishRatePct })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Fairness tab of the organizer Metrics page (S-80 AC 4): three tables of aggregates. */
export function FairnessTable({ fairness }: { fairness: Fairness }) {
  const t = useTranslations("metrics.fairness");
  const routes = useTranslations("routes");
  return (
    <>
      <p className={styles.hint}>{t("hint")}</p>
      <GroupTable
        id="fairness-start"
        title={t("byStart")}
        head={t("start")}
        groups={fairness.byStart}
        label={(k) => (k === "none" ? t("noStart") : routes(`route01.${k}`))}
      />
      <GroupTable
        id="fairness-size"
        title={t("byTeamSize")}
        head={t("size")}
        groups={fairness.byTeamSize}
        label={(k) => t("sizeValue", { count: Number(k) })}
      />
      <GroupTable
        id="fairness-active"
        title={t("byActive")}
        head={t("active")}
        groups={fairness.byActiveMembers}
        label={(k) => t(`bands.${k}`)}
      />
    </>
  );
}
