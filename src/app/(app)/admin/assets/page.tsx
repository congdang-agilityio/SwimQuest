import { getTranslations } from "next-intl/server";
import { AssetGallery } from "@/components/admin/asset-gallery";
import adminStyles from "@/components/admin/admin.module.css";
import { EmptyState } from "@/components/states/empty-state";
import { ScreenHeader } from "@/components/ui";
import { listAssetStatus } from "@/lib/art/asset-status";
import { getCurrentUser } from "@/server/auth/current-user";
import { requirePlatformAdmin } from "@/server/auth/roles";

/** Admin asset gallery: every registry asset on a light and a dark tile; missing files are marked. */
export default async function AdminAssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string | string[] }>;
}) {
  requirePlatformAdmin(await getCurrentUser());
  const t = await getTranslations("admin.assets");
  const { group } = await searchParams;
  const all = listAssetStatus();
  const groups = [...new Set(all.map((a) => a.group))];
  const wanted = [group ?? []].flat()[0];
  const selected = wanted && groups.includes(wanted) ? wanted : "";
  const shown = selected ? all.filter((a) => a.group === selected) : all;
  return (
    <main className={adminStyles.screen}>
      <div className={adminStyles.headerBand}>
        <ScreenHeader title={t("title")} backHref="/admin" backLabel={t("back")} />
      </div>
      {all.length ? (
        <AssetGallery
          assets={shown}
          groups={groups}
          selected={selected}
          total={all.length}
          missing={all.filter((a) => !a.exists).length}
        />
      ) : (
        <EmptyState message={t("empty")} />
      )}
    </main>
  );
}
