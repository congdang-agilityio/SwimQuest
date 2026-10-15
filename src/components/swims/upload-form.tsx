"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { OwnerSwimDto } from "@/server/swims/swim-dto";
import { SwimSummary } from "./swim-summary";

const tap = { minHeight: 44, minWidth: 44 } as const;

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
      <form onSubmit={onSubmit} aria-busy={!!state.busy}>
        <p>
          <label htmlFor="swim-file">{t("connect.upload")}</label>
          <br />
          <input
            id="swim-file"
            name="file"
            type="file"
            accept=".gpx,.fit"
            style={tap}
            disabled={state.busy}
            aria-describedby="swim-file-hint"
            aria-invalid={state.code ? true : undefined}
          />
          <br />
          <small id="swim-file-hint">{t("connect.uploadHint")}</small>
        </p>
        <button type="submit" disabled={state.busy} style={tap}>
          {t("connect.submit")}
        </button>
      </form>
      <p role="status">{state.busy ? t("connect.busy") : ""}</p>
      {state.code && (
        <div role="alert" style={{ color: "#b91c1c" }}>
          <p>{t(`errors.${state.code}`)}</p>
          <p>{t("connect.exportHint")}</p>
        </div>
      )}
      {state.swim && <SwimSummary swim={state.swim} />}
    </>
  );
}
