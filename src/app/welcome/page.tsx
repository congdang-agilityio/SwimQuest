import { getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import { ButtonLink } from "@/components/ui";
import { HowItWorks } from "@/components/welcome/how-it-works";
import styles from "@/components/welcome/welcome.module.css";

export async function generateMetadata() {
  const t = await getTranslations("common");
  return { title: `${t("appName")} – ${t("tagline")}` };
}

/**
 * Public welcome page (S-70): the mockup's brand hero (coast, logo, swimmers), what SwimQuest
 * is, the seven legs of the voyage, sign-up / log-in calls to action and a safety note.
 */
export default async function WelcomePage() {
  const [t, tc] = await Promise.all([getTranslations("welcome"), getTranslations("common")]);
  const ctas = (
    <div className={styles.ctas}>
      <ButtonLink href="/signup" block>
        {t("signUp")}
      </ButtonLink>
      <ButtonLink href="/login" variant="secondary" block>
        {t("logIn")}
      </ButtonLink>
    </div>
  );
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.sky} aria-hidden="true">
          <MockupPicture
            artKey="scenes/beach-da-nang-16x9"
            sources={[{ media: "(max-width: 640px)", artKey: "scenes/beach-da-nang-9x16" }]}
            alt=""
            className={styles.cover}
            eager
          />
        </div>
        <div className={styles.sea} aria-hidden="true">
          <MockupPicture artKey="scenes/hero-swimmers-16x9" alt="" className={styles.cover} eager />
        </div>
        <div className={styles.heroContent}>
          <h1 className={styles.brand}>
            <MockupPicture
              artKey="brand/logo"
              alt={tc("appName")}
              className={styles.logo}
              eager
              fallback={tc("appName")}
            />
          </h1>
          <p className={styles.tagline}>{t("tagline")}</p>
          <div className={styles.intro}>
            <p className={styles.lead}>{t("lead")}</p>
            {ctas}
          </div>
        </div>
      </header>

      <div className={styles.body}>
        <HowItWorks />

        <section aria-labelledby="cta-title" className={styles.join}>
          <div className={styles.joinArt} aria-hidden="true">
            <MockupPicture artKey="ships/ship-tier-2" alt="" className={styles.joinImg} />
          </div>
          <div className={styles.joinText}>
            <h2 id="cta-title" className={styles.sectionTitle}>
              {t("cta.title")}
            </h2>
            <p className={styles.sectionIntro}>{t("cta.body")}</p>
            {ctas}
          </div>
        </section>

        <aside aria-labelledby="safety-title" className={styles.safety}>
          <h2 id="safety-title" className={styles.safetyTitle}>
            {t("safety.title")}
          </h2>
          <p className={styles.safetyBody}>{t("safety.body")}</p>
        </aside>
      </div>
    </main>
  );
}
