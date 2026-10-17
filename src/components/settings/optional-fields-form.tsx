"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import styles from "./settings-card.module.css";
import { ImageUploadField } from "./image-upload-field";
import { Button, Field, TextareaField } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import { OPTIONAL_LIMITS } from "@/lib/validation/settings/optional";

type Status = "idle" | "saved" | "failed" | "network";
export type OptionalValues = {
  bannerImageId: string | null;
  logoImageId: string | null;
  rulesUrl: string | null;
  eligibilityNotes: string | null;
  contactChannel: string | null;
  rulesText: string | null;
};
const KNOWN_ERRORS = new Set([
  "INVALID_URL",
  "ELIGIBILITY_NOTES_TOO_LONG",
  "CONTACT_CHANNEL_TOO_LONG",
  "RULES_TEXT_TOO_LONG",
  "IMAGE_INVALID",
]);

/** Organizer form for the optional fields (banner, logo, links, notes). Always editable, even after publishing. */
export function OptionalFieldsForm({
  tournamentId,
  values,
}: {
  tournamentId: string;
  values: OptionalValues;
}) {
  const t = useTranslations("settings.optional");
  const [banner, setBanner] = useState(values.bannerImageId);
  const [logo, setLogo] = useState(values.logoImageId);
  const [text, setText] = useState({
    rulesUrl: values.rulesUrl ?? "",
    contactChannel: values.contactChannel ?? "",
    eligibilityNotes: values.eligibilityNotes ?? "",
    rulesText: values.rulesText ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("idle");
    setErrors({});
    try {
      const res = await clientFetch(
        `/api/tournaments/${encodeURIComponent(tournamentId)}/settings`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            group: "optional",
            values: { bannerImageId: banner, logoImageId: logo, ...text },
          }),
        },
      );
      if (res.ok) {
        setStatus("saved");
      } else if (res.status === 400) {
        const fields = (await res.json().catch(() => null))?.error?.fields;
        const known: Record<string, string> = {};
        if (fields && typeof fields === "object")
          for (const [k, v] of Object.entries(fields))
            known[k] = typeof v === "string" && KNOWN_ERRORS.has(v) ? v : "UNKNOWN";
        setErrors(known);
        if (Object.keys(known).length === 0) setStatus("failed");
      } else {
        setStatus("failed");
      }
    } catch {
      setStatus("network");
    } finally {
      setBusy(false);
    }
  }

  const set = (name: keyof typeof text) => (e: { target: { value: string } }) => {
    setText((s) => ({ ...s, [name]: e.target.value }));
    setStatus("idle");
  };
  const err = (name: string) => (errors[name] ? t(`errors.${errors[name]}`) : undefined);
  const bannerError = errors.bannerImageId || errors.logoImageId;

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="optional-settings-title">
      <h2 id="optional-settings-title" className={styles.heading}>
        {t("title")}
      </h2>
      <p className={styles.intro}>{t("intro")}</p>
      <fieldset className={styles.stack}>
        <legend className={styles.legend}>{t("imagesLegend")}</legend>
        <ImageUploadField
          kind="TOURNAMENT_BANNER"
          label={t("fields.banner")}
          hint={t("hints.banner")}
          value={banner}
          onChange={(id) => {
            setBanner(id);
            setStatus("idle");
          }}
        />
        <ImageUploadField
          kind="TOURNAMENT_LOGO"
          label={t("fields.logo")}
          hint={t("hints.logo")}
          value={logo}
          onChange={(id) => {
            setLogo(id);
            setStatus("idle");
          }}
        />
        {bannerError && (
          <p role="alert" className={styles.fieldError}>
            {t(`errors.${KNOWN_ERRORS.has(bannerError) ? bannerError : "UNKNOWN"}`)}
          </p>
        )}
      </fieldset>
      <fieldset className={styles.stack}>
        <legend className={styles.legend}>{t("linksLegend")}</legend>
        <Field
          id="rulesUrl"
          name="rulesUrl"
          type="url"
          inputMode="url"
          placeholder="https://"
          label={t("fields.rulesUrl")}
          hint={t("hints.rulesUrl")}
          maxLength={OPTIONAL_LIMITS.rulesUrl}
          value={text.rulesUrl}
          onChange={set("rulesUrl")}
          error={err("rulesUrl")}
        />
        <Field
          id="contactChannel"
          name="contactChannel"
          label={t("fields.contactChannel")}
          hint={t("hints.contactChannel")}
          maxLength={OPTIONAL_LIMITS.contactChannel}
          value={text.contactChannel}
          onChange={set("contactChannel")}
          error={err("contactChannel")}
        />
      </fieldset>
      <fieldset className={styles.stack}>
        <legend className={styles.legend}>{t("textLegend")}</legend>
        <TextareaField
          id="eligibilityNotes"
          name="eligibilityNotes"
          rows={4}
          label={t("fields.eligibilityNotes")}
          hint={t("hints.eligibilityNotes")}
          maxLength={OPTIONAL_LIMITS.eligibilityNotes}
          value={text.eligibilityNotes}
          onChange={set("eligibilityNotes")}
          error={err("eligibilityNotes")}
        />
        <TextareaField
          id="rulesText"
          name="rulesText"
          rows={8}
          label={t("fields.rulesText")}
          hint={t("hints.rulesText")}
          maxLength={OPTIONAL_LIMITS.rulesText}
          value={text.rulesText}
          onChange={set("rulesText")}
          error={err("rulesText")}
        />
      </fieldset>
      <div className={styles.actions}>
        <Button type="submit" variant="primary" block disabled={busy}>
          {busy ? t("saving") : t("save")}
        </Button>
      </div>
      {status === "saved" && (
        <p role="status" className={styles.status}>
          {t("saved")}
        </p>
      )}
      {(status === "failed" || status === "network") && (
        <p role="alert" className={styles.failed}>
          {status === "network" ? t("networkError") : t("failed")}
        </p>
      )}
    </form>
  );
}
