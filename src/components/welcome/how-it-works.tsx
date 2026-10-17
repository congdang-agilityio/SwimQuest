import { getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import styles from "./welcome.module.css";

/** The mockup's top row: seven numbered legs of the voyage, each with its cut art. */
const STEPS = [
  { id: "signup", art: "characters/portrait-blue-cap" },
  { id: "tournament", art: "medals/trophy-rank-1" },
  { id: "team", art: "badges/badge-teamwork" },
  { id: "start", art: "landmarks/landmark-02-son-thuy" },
  { id: "swim", art: "poses/freestyle-01" },
  { id: "progress", art: "ships/boat-team-blue" },
  { id: "finish", art: "landmarks/landmark-07-ly-son" },
] as const;

export async function HowItWorks() {
  const t = await getTranslations("welcome");
  return (
    <section aria-labelledby="how-title" className={styles.how}>
      <h2 id="how-title" className={styles.sectionTitle}>
        {t("how.title")}
      </h2>
      <p className={styles.sectionIntro}>{t("how.intro")}</p>
      <ol className={styles.steps}>
        {STEPS.map(({ id, art }, i) => (
          <li key={id} className={styles.step}>
            <span className={styles.number} aria-hidden="true">
              {i + 1}
            </span>
            <div className={styles.stepArt}>
              <MockupPicture artKey={art} alt="" className={styles.stepImg} />
            </div>
            <div className={styles.stepText}>
              <h3 className={styles.stepTitle}>{t(`steps.${id}.title`)}</h3>
              <p className={styles.stepBody}>{t(`steps.${id}.body`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
