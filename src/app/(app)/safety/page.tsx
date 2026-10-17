import { getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import { Card, ScreenHeader } from "@/components/ui";
import styles from "@/components/safety/safety.module.css";

const TIPS = [
  { id: "night", art: "scenes/sea-night-4x3" },
  { id: "alone", art: "items/rescue-buoy" },
  { id: "limits", art: "items/goggles" },
  { id: "map", art: "items/treasure-map" },
] as const;

export default async function SafetyPage() {
  const [t, tCommon] = await Promise.all([getTranslations("safety"), getTranslations("common")]);
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/profile" backLabel={tCommon("back")} />
      </div>
      <Card className={styles.hero}>
        <MockupPicture
          artKey="scenes/sunrise-coast-4x3"
          sources={[{ media: "(min-width: 640px)", artKey: "scenes/sunrise-coast-16x9" }]}
          alt={t("heroAlt")}
          className={styles.heroImage}
          eager
        />
        <p className={styles.intro}>{t("intro")}</p>
      </Card>
      <ul className={styles.tips}>
        {TIPS.map(({ id, art }) => (
          <li key={id}>
            <Card className={styles.tip}>
              <span className={styles.tipArt}>
                <MockupPicture
                  artKey={art}
                  alt=""
                  className={art.startsWith("scenes/") ? styles.tipScene : styles.tipItem}
                />
              </span>
              <div>
                <h2 className={styles.tipTitle}>{t(`tips.${id}.title`)}</h2>
                <p className={styles.tipBody}>{t(`tips.${id}.body`)}</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
