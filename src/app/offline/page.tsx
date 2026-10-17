import { getTranslations } from "next-intl/server";
import { MockupPicture } from "@/components/art/mockup-picture";
import { OfflineRetry } from "@/components/pwa/offline-retry";
import { StateCard } from "@/components/states/state-card";
import styles from "./offline.module.css";

export async function generateMetadata() {
  const t = await getTranslations("states.offline");
  return { title: `${t("title")} · SwimQuest`, robots: { index: false } };
}

/**
 * Public offline page. The service worker caches it with its assets and shows it for any page
 * the network cannot load. It holds no user data, so it is safe to keep across sessions.
 */
export default async function OfflinePage() {
  const [t, tc] = await Promise.all([getTranslations("states.offline"), getTranslations("common")]);
  return (
    <main className={styles.page}>
      <div className={styles.brandRow}>
        <MockupPicture
          artKey="brand/logo"
          alt={tc("appName")}
          className={styles.logo}
          eager
          fallback={<span className={styles.brand}>{tc("appName")}</span>}
        />
      </div>
      <StateCard
        art="items/rescue-buoy"
        role="status"
        titleId="state-offline"
        title={t("title")}
        body={t("body")}
      >
        <OfflineRetry label={t("retry")} />
      </StateCard>
    </main>
  );
}
