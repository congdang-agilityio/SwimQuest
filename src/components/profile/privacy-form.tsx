"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { SelectField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import {
  PRIVACY_FIELDS,
  PRIVACY_LEVELS,
  type PrivacyField,
  type PrivacyLevel,
  type PrivacySettings,
} from "@/lib/privacy";
import styles from "./privacy-form.module.css";

/** One level per profile part; each change is saved straight away through PUT /api/me/privacy. */
export function PrivacyForm({ initial }: { initial: PrivacySettings }) {
  const t = useTranslations("privacy");
  const [values, setValues] = useState<PrivacySettings>(initial);
  const [state, setState] = useState<"idle" | "saved" | "failed">("idle");

  async function onChange(field: PrivacyField, event: ChangeEvent<HTMLSelectElement>) {
    const previous = values[field];
    const level = event.target.value as PrivacyLevel;
    setValues((v) => ({ ...v, [field]: level }));
    setState("idle");
    try {
      const res = await clientFetch("/api/me/privacy", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: level }),
      });
      if (!res.ok) throw new Error("save failed");
      setState("saved");
    } catch {
      setValues((v) => ({ ...v, [field]: previous }));
      setState("failed");
    }
  }

  return (
    <div className={styles.form}>
      {PRIVACY_FIELDS.map((field) => (
        <SelectField
          key={field}
          id={`privacy-${field}`}
          label={t(`fields.${field}`)}
          value={values[field]}
          onChange={(event) => onChange(field, event)}
        >
          {PRIVACY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t(`levels.${level}`)}
            </option>
          ))}
        </SelectField>
      ))}
      <div aria-live="polite">
        {state === "saved" && <p className={styles.status}>{t("saved")}</p>}
        {state === "failed" && (
          <p className={styles.problem} role="alert">
            {t("failed")}
          </p>
        )}
      </div>
    </div>
  );
}
