"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SectionHeader, Switch } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import {
  ZALO_SWITCH_KEYS,
  type ZaloSwitchKey,
  type ZaloSwitches,
} from "@/server/zalo/switch-kinds";
import styles from "./zalo.module.css";

/**
 * The seven Zalo message switches (S-89 AC 1), each saved at once through `PATCH`. The
 * introduction is listed as always sent, without a switch.
 */
export function ZaloSwitchesPanel({
  tournamentId,
  initial,
  readOnly,
}: {
  tournamentId: string;
  initial: ZaloSwitches;
  readOnly: boolean;
}) {
  const t = useTranslations("zalo.switches");
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState<ZaloSwitchKey | null>(null);
  const [status, setStatus] = useState<"saved" | "failed" | null>(null);
  const inFlight = useRef(false);

  async function toggle(key: ZaloSwitchKey, next: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(key);
    setStatus(null);
    setValues((v) => ({ ...v, [key]: next }));
    try {
      const res = await clientFetch(`/api/tournaments/${encodeURIComponent(tournamentId)}/zalo`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ switches: { [key]: next } }),
      }).catch(() => null);
      const body = res?.ok ? await res.json().catch(() => null) : null;
      if (body?.switches) {
        setValues(body.switches as ZaloSwitches);
        setStatus("saved");
      } else {
        setValues((v) => ({ ...v, [key]: !next }));
        setStatus("failed");
      }
    } finally {
      inFlight.current = false;
      setSaving(null);
    }
  }

  return (
    <section aria-labelledby="zalo-switches-title" className={styles.panel}>
      <SectionHeader id="zalo-switches-title">{t("title")}</SectionHeader>
      <div className={styles.body}>
        <p className={styles.muted}>{t("intro")}</p>
        <div className={styles.always}>
          <span className={styles.alwaysLabel}>{t("introMessage")}</span>
          <span className={styles.alwaysNote}>{t("always")}</span>
        </div>
        <div className={styles.switches}>
          {ZALO_SWITCH_KEYS.map((key) => (
            <Switch
              key={key}
              id={`zalo-switch-${key}`}
              label={t(`kinds.${key}.label`)}
              hint={t(`kinds.${key}.hint`)}
              checked={values[key]}
              disabled={readOnly || saving !== null}
              onChange={(next) => toggle(key, next)}
            />
          ))}
        </div>
        {status === "saved" && (
          <p role="status" className={styles.saved}>
            {t("saved")}
          </p>
        )}
        {status === "failed" && (
          <p role="alert" className={styles.error}>
            {t("failed")}
          </p>
        )}
      </div>
    </section>
  );
}
