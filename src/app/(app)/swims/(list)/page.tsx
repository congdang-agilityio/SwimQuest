import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { ScreenHeader } from "@/components/ui";
import { SwimList } from "@/components/swims/swim-list";
import styles from "@/components/swims/swims.module.css";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { listMySwims } from "@/server/swims/my-swims";

export default async function MySwimsPage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/swims");
  const t = await getTranslations("my-swims");
  const tCommon = await getTranslations("common");
  const page = await listMySwims(user.id);
  return (
    <main className={styles.screen}>
      <div className={styles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/profile" backLabel={tCommon("back")} />
      </div>
      <SwimList initialItems={page.items} initialCursor={page.nextCursor} />
    </main>
  );
}
