"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import {
  PUSH_CATEGORIES,
  type PushCategory,
  type PushPreferences,
} from "@/lib/notification-preferences";
import styles from "./notification-settings.module.css";

/** One push switch per category, saved for the account straight away (S-68). */
export function CategorySwitches({ initial }: { initial: PushPreferences }) {
  const t = useTranslations("notifications.settings.categories");
  const [values, setValues] = useState<PushPreferences>(initial);
  const [saving, setSaving] = useState<PushCategory | null>(null);
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");

  async function onChange(category: PushCategory, on: boolean) {
    setValues((v) => ({ ...v, [category]: on }));
    setSaving(category);
    setState("idle");
    try {
      const res = await clientFetch("/api/me/notification-preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ push: { [category]: on } }),
      });
      if (!res.ok) throw new Error("save failed");
      const body = (await res.json()) as { push: PushPreferences };
      setValues(body.push);
      setState("saved");
    } catch {
      setValues((v) => ({ ...v, [category]: !on }));
      setState("failed");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className={styles.push}>
      <div className={styles.switches}>
        {PUSH_CATEGORIES.map((category) => (
          <Switch
            key={category}
            id={`push-category-${category.toLowerCase()}`}
            label={t(`${category}.label`)}
            hint={t(`${category}.hint`)}
            checked={values[category]}
            disabled={saving === category}
            onChange={(on) => onChange(category, on)}
          />
        ))}
      </div>
      <p className={styles.note}>{t("note")}</p>
      <div aria-live="polite">
        {state === "saved" && <p className={styles.saved}>{t("saved")}</p>}
        {state === "failed" && (
          <p className={styles.problem} role="alert">
            {t("failed")}
          </p>
        )}
      </div>
    </div>
  );
}
