import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SwimDetail } from "@/components/swims/swim-detail";
import { NEXT_PATH_HEADER } from "@/lib/auth/public-paths";
import { requireUser } from "@/server/auth/current-user";
import { getMySwim } from "@/server/swims/my-swims";

export default async function SwimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser((await headers()).get(NEXT_PATH_HEADER) ?? `/swims/${id}`);
  const swim = await getMySwim(user.id, id);
  if (!swim) notFound();
  const t = await getTranslations("my-swims.detail");
  return (
    <main>
      <h1>{t("title")}</h1>
      <SwimDetail swim={swim} />
    </main>
  );
}
