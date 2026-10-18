"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button, Card } from "@/components/ui";
import { applyUpdate, dismissUpdate, getUpdateState, subscribeUpdate } from "@/lib/pwa/app-update";
import { isBusy, subscribeBusy } from "@/lib/pwa/busy";
import styles from "./update-card.module.css";

const serverState = { available: false, dismissed: false };

/**
 * "A new version is available — Update / Later" (#922), mounted once in the root layout so it
 * shows on every page. Never shown during an upload or a form submit; never applied by itself.
 */
export function UpdateCard() {
  const t = useTranslations("pwa.update");
  const { available, dismissed } = useSyncExternalStore(
    subscribeUpdate,
    getUpdateState,
    () => serverState,
  );
  const busy = useSyncExternalStore(subscribeBusy, isBusy, () => false);
  const [updating, setUpdating] = useState(false);
  if (!available || dismissed || (busy && !updating)) return null;

  return (
    <div className={styles.wrap}>
      <Card role="status" className={styles.card} data-testid="update-card">
        <Image
          src="/art/mockup/brand/app-icon.webp"
          alt=""
          width={40}
          height={40}
          className={styles.icon}
        />
        <div className={styles.text}>
          <p className={styles.title}>{t("title")}</p>
          <p className={styles.body}>{t("body")}</p>
          <div className={styles.actions}>
            <Button
              size="sm"
              disabled={updating}
              aria-busy={updating}
              onClick={() => {
                setUpdating(true);
                void applyUpdate();
              }}
              data-testid="update-now"
            >
              {updating ? t("updating") : t("update")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={updating}
              onClick={dismissUpdate}
              data-testid="update-later"
            >
              {t("later")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
