"use client";

import { useLocale, useTranslations } from "next-intl";
import { Avatar, Button, Card } from "@/components/ui";
import { imageSrc, profileAvatarSrc } from "@/lib/profile-avatar";
import { regionName } from "@/lib/regions";
import type { MyProfile } from "@/server/profile/my-profile";
import styles from "./profile-view.module.css";

/** My Profile in view mode: cover, avatar, name, city/region and bio. */
export function ProfileView({ profile, onEdit }: { profile: MyProfile; onEdit: () => void }) {
  const t = useTranslations("profile.view");
  const locale = useLocale() === "en" ? "en" : "vi";
  const cover = imageSrc(profile.coverImageId);
  const region = regionName(profile.regionCode, locale);
  return (
    <Card tone="dark" as="section" className={styles.hero} aria-label={profile.displayName}>
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element -- the player's uploaded cover
        <img src={cover} alt={t("coverAlt")} className={styles.cover} />
      )}
      <div className={styles.body}>
        <Avatar name={profile.displayName} src={profileAvatarSrc(profile)} size={72} decorative />
        <h2 className={styles.name}>{profile.displayName}</h2>
        {region && <p className={styles.region}>{region}</p>}
        <p className={styles.bio}>{profile.bio || t("noBio")}</p>
        <Button variant="secondary" size="sm" onClick={onEdit}>
          {t("edit")}
        </Button>
      </div>
    </Card>
  );
}
