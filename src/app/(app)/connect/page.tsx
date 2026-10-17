import { getTranslations } from "next-intl/server";
import { ScreenHeader } from "@/components/ui";
import { SafetyReminder } from "@/components/safety/safety-reminder";
import { UploadForm } from "@/components/swims/upload-form";
import styles from "@/components/swims/swims.module.css";

export default async function ConnectPage() {
  const t = await getTranslations("swims.connect");
  const tCommon = await getTranslations("common");
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/team" backLabel={tCommon("back")} />
      </div>
      <SafetyReminder />
      <UploadForm />
    </main>
  );
}
