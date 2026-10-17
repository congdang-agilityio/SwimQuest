import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { CategorySwitches } from "@/components/notifications/category-switches";
import { PushToggle } from "@/components/notifications/push-toggle";
import { Card, ScreenHeader } from "@/components/ui";
import { mockupArt } from "@/lib/art/mockup-art";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { getPushPreferences } from "@/server/notifications/preferences";
import styles from "@/components/notifications/notification-settings.module.css";

/** Profile > Notifications: push on this device (S-67) and push per category (S-68). */
export default async function NotificationSettingsPage() {
  const user = await requireUser(
    (await headers()).get(NEXT_PATH_HEADER) ?? "/profile/notifications",
  );
  const [t, common, push] = await Promise.all([
    getTranslations("notifications.settings"),
    getTranslations("common"),
    getPushPreferences(user.id),
  ]);
  const art = mockupArt("items/message-bottle")?.webp;
  return (
    <main className={styles.page}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/profile" backLabel={common("back")} />
      </div>

      <Card as="section" className={styles.card} aria-labelledby="push-title">
        <div className={styles.head}>
          {art && (
            // eslint-disable-next-line @next/next/no-img-element -- static art, no optimisation needed
            <img src={art} alt="" className={styles.art} />
          )}
          <div>
            <h2 id="push-title" className={styles.heading}>
              {t("push.title")}
            </h2>
            <p className={styles.text}>{t("push.intro")}</p>
          </div>
        </div>
        <PushToggle />
      </Card>

      <Card as="section" className={styles.card} aria-labelledby="categories-title">
        <div>
          <h2 id="categories-title" className={styles.heading}>
            {t("categories.title")}
          </h2>
          <p className={styles.text}>{t("categories.intro")}</p>
        </div>
        {push ? (
          <CategorySwitches initial={push} />
        ) : (
          <p className={styles.problem}>{t("categories.loadFailed")}</p>
        )}
      </Card>
    </main>
  );
}
