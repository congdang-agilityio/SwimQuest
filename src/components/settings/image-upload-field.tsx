"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import styles from "./settings-card.module.css";
import { Button } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import { imageSrc } from "@/lib/profile-avatar";

const KNOWN_ERRORS = new Set(["IMAGE_TOO_LARGE", "IMAGE_TYPE_NOT_ALLOWED"]);

/** Uploads one picture to `/api/images` with a kind; shows a preview and a remove button. */
export function ImageUploadField({
  kind,
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  kind: "TOURNAMENT_BANNER" | "TOURNAMENT_LOGO";
  label: string;
  hint: string;
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("settings.optional");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const src = imageSrc(value);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);
      const res = await clientFetch("/api/images", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.id) onChange(json.id);
      else {
        const code = json?.error?.fields?.file ?? json?.error?.code;
        setError(KNOWN_ERRORS.has(code) ? code : "UPLOAD_FAILED");
      }
    } catch {
      setError("UPLOAD_FAILED");
    }
    setUploading(false);
  }

  return (
    <div className={styles.imageField}>
      <span className={styles.imageLabel}>{label}</span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- the organizer's uploaded picture
        <img
          src={src}
          alt=""
          className={kind === "TOURNAMENT_BANNER" ? styles.banner : styles.logo}
        />
      )}
      <div className={styles.imageRow}>
        <label className={styles.upload}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className={styles.file}
            disabled={disabled || uploading}
            onChange={upload}
          />
          {uploading ? t("uploading") : value ? t("replace") : t("upload")}
        </label>
        {value && !disabled && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            {t("remove")}
          </Button>
        )}
      </div>
      <p className={styles.imageHint}>{hint}</p>
      {error && (
        <p role="alert" className={styles.fieldError}>
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}
