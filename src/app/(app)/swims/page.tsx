import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { SwimList } from "@/components/swims/swim-list";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { listMySwims } from "@/server/swims/my-swims";

export default async function MySwimsPage() {
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? "/swims");
  const t = await getTranslations("my-swims");
  const page = await listMySwims(user.id);
  return (
    <main>
      <h1>{t("title")}</h1>
      <SwimList initialItems={page.items} initialCursor={page.nextCursor} />
    </main>
  );
}
