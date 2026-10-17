"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { OwnerSwimDto } from "@/server/swims/swim-dto";
import { Button, Card } from "@/components/ui";
import { SwimSummary } from "./swim-summary";
import styles from "./swims.module.css";

type State = { busy?: boolean; swim?: OwnerSwimDto; code?: string };

/** Uploads one GPX/FIT file to POST /api/swims and shows the saved swim or why it failed. */
export function UploadForm() {
  const t = useTranslations("swims");
  const [state, setState] = useState<State>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size) return setState({ code: "FILE_REQUIRED" });
    setState({ busy: true });
    try {
      const res = await fetch("/api/swims", { method: "POST", body: data });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.swim) return setState({ swim: body.swim });
      const code = body?.error?.code;
      setState({ code: t.has(`errors.${code}`) ? code : "GENERIC" });
    } catch {
      setState({ code: "GENERIC" });
    }
  }

  return (
    <>
      {state.code && (
        <Card role="alert" className={styles.alert}>
          <p>{t(`errors.${state.code}`)}</p>
          <p>{t("connect.exportHint")}</p>
        </Card>
      )}
      {state.swim && <SwimSummary swim={state.swim} />}
      <Card>
        <form onSubmit={onSubmit} aria-busy={!!state.busy} className={styles.form}>
          <div>
            <label htmlFor="swim-file" className={styles.fieldLabel}>
              {t("connect.upload")}
            </label>
            <div className={styles.dropZone}>
              <UploadIcon />
              <input
                id="swim-file"
                name="file"
                type="file"
                accept=".gpx,.fit"
                className={styles.fileInput}
                disabled={state.busy}
                aria-describedby="swim-file-hint"
                aria-invalid={state.code ? true : undefined}
              />
              <small id="swim-file-hint" className={styles.hint}>
                {t("connect.uploadHint")}
              </small>
            </div>
          </div>
          <Button type="submit" variant="primary" block disabled={state.busy}>
            {t("connect.submit")}
          </Button>
          <p role="status" className={styles.status}>
            {state.busy ? t("connect.busy") : ""}
          </p>
        </form>
      </Card>
    </>
  );
}

function UploadIcon() {
  return (
    <svg
      className={styles.uploadIcon}
      width="32"
      height="32"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
