import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArtImage } from "@/components/art/art-image";
import { Chip } from "@/components/ui";
import { ICON_GROUPS, type AssetStatus } from "@/lib/art/asset-status";
import { mockupAlt, toArtAsset } from "@/lib/art/mockup-art";
import styles from "./asset-gallery.module.css";

const SMALL_SIZES = [24, 32, 48] as const;

type Props = {
  assets: AssetStatus[];
  groups: string[];
  /** Selected group, or "" for all. */
  selected: string;
  total: number;
  missing: number;
};

/** The registry's assets at their spec size (and 24, 32, 48 px for icons) on a light and a dark tile. */
export async function AssetGallery({ assets, groups, selected, total, missing }: Props) {
  const t = await getTranslations("admin.assets");
  const locale = await getLocale();
  const label = (scope: "groups" | "sources", key: string) =>
    t.has(`${scope}.${key}`) ? t(`${scope}.${key}`) : key;

  return (
    <>
      <p className={styles.summary} data-testid="asset-summary">
        {t("summary", { total, missing })}
      </p>
      <nav aria-label={t("filter")} className={styles.filter}>
        {["", ...groups].map((g) => (
          <Link
            key={g || "all"}
            href={g ? `/admin/assets?group=${g}` : "/admin/assets"}
            aria-current={g === selected ? "page" : undefined}
            className={styles.filterLink}
          >
            {g ? label("groups", g) : t("all")}
          </Link>
        ))}
      </nav>
      <ul className={styles.list}>
        {assets.map((a) => {
          const art = toArtAsset(a);
          const alt = mockupAlt(a, locale);
          const small = ICON_GROUPS.includes(a.group);
          const tile = (mode: "light" | "dark") => (
            <div className={styles.tile} data-tone={mode} data-testid={`tile-${mode}`}>
              <p className={styles.tileLabel}>{t(mode === "light" ? "light" : "dark")}</p>
              <div className={styles.spec} style={{ width: a.width }}>
                <ArtImage
                  art={art}
                  alt={alt}
                  className={styles.img}
                  fallback={<span className={styles.fallback} role="img" aria-label={alt} />}
                />
              </div>
              {small && (
                <div className={styles.sizes}>
                  {SMALL_SIZES.map((px) => (
                    <span key={px} className={styles.size}>
                      <span style={{ width: px, height: px }} className={styles.sizeBox}>
                        <ArtImage
                          art={art}
                          alt={alt}
                          className={styles.img}
                          fallback={
                            <span className={styles.fallback} role="img" aria-label={alt} />
                          }
                        />
                      </span>
                      {px}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
          return (
            <li key={a.key} className={styles.item} data-testid="asset-item">
              <div className={styles.head}>
                <h2 className={styles.id}>{a.key}</h2>
                <Chip tone={a.exists ? "success" : "danger"}>
                  {a.exists ? t("present") : t("missing")}
                </Chip>
              </div>
              <dl className={styles.meta}>
                <dt>{t("path")}</dt>
                <dd>
                  <code>public{a.file}</code>
                </dd>
                <dt>{t("size")}</dt>
                <dd>
                  {a.width}x{a.height}
                </dd>
                <dt>{t("source")}</dt>
                <dd>{label("sources", a.source)}</dd>
                <dt>{t("usage")}</dt>
                <dd>{label("groups", a.group)}</dd>
              </dl>
              <div className={styles.tiles}>
                {tile("light")}
                {tile("dark")}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
