"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { EMBLEM_KEYS } from "@/lib/emblems";
import { clientFetch } from "@/lib/http/client-fetch";
import { parseTeamInput, type TeamErrorCode, type TeamField } from "@/lib/validation/team";
import { TeamEmblem } from "./team-emblem";

export type TeamFormValues = {
  name: string;
  emblemKey: string;
  description: string;
  memberLimit: number;
};

type Props = {
  /** POST target for a new team, or PATCH target for an existing one. */
  action: { method: "POST" | "PATCH"; url: string };
  initial?: TeamFormValues;
  onSaved: () => void;
  onCancel: () => void;
};

type FieldError = TeamErrorCode | "LIMIT_BELOW_MEMBERS";
type Errors = Partial<Record<TeamField, FieldError>>;

const control = { minHeight: 44, width: "100%", boxSizing: "border-box", padding: 8 } as const;
const touch = { minHeight: 44, minWidth: 44, boxSizing: "border-box", padding: 8 } as const;
const errorColor = { color: "#b91c1c" };

export function TeamForm({ action, initial, onSaved, onCancel }: Props) {
  const t = useTranslations("teams");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [emblem, setEmblem] = useState(initial?.emblemKey ?? "");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rawLimit = String(form.get("memberLimit") ?? "").trim();
    const parsed = parseTeamInput({
      name: form.get("name"),
      emblemKey: emblem,
      description: form.get("description"),
      // The API needs a JSON number, never the string from the input.
      memberLimit: rawLimit === "" ? Number.NaN : Number(rawLimit),
    });
    setFailed(false);
    setErrors(parsed.ok ? {} : parsed.errors);
    if (!parsed.ok) return;
    setBusy(true);
    try {
      const res = await clientFetch(action.url, {
        method: action.method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        onSaved();
        return;
      }
      const body = await res.json().catch(() => null);
      const code = body?.error?.code;
      if (res.status === 409 && code === "LIMIT_BELOW_MEMBERS") {
        setErrors({ memberLimit: "LIMIT_BELOW_MEMBERS" });
      } else if (res.status === 400 && body?.error?.fields) {
        setErrors(body.error.fields);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  const fieldProps = (name: TeamField) => ({
    "aria-invalid": errors[name] ? (true as const) : undefined,
    "aria-describedby": errors[name] ? `team-${name}-error` : undefined,
  });
  const fieldError = (name: TeamField) =>
    errors[name] && (
      <span id={`team-${name}-error`} role="alert" style={errorColor}>
        {t(`errors.${errors[name]}`)}
      </span>
    );

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="team-form-title">
      <h3 id="team-form-title">{t(initial ? "form.editTitle" : "form.addTitle")}</h3>
      <p>
        <label htmlFor="team-name">{t("form.name")}</label>
        <input
          id="team-name"
          name="name"
          type="text"
          defaultValue={initial?.name ?? ""}
          {...fieldProps("name")}
          style={control}
        />
        {fieldError("name")}
      </p>
      <fieldset {...fieldProps("emblemKey")}>
        <legend>{t("form.emblem")}</legend>
        {EMBLEM_KEYS.map((key) => (
          <label
            key={key}
            style={{ ...touch, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <input
              type="radio"
              name="emblemKey"
              value={key}
              checked={emblem === key}
              onChange={() => setEmblem(key)}
              style={touch}
            />
            <TeamEmblem emblemKey={key} size={32} alt={t(`emblems.${key}`)} />
          </label>
        ))}
        {fieldError("emblemKey")}
      </fieldset>
      <p>
        <label htmlFor="team-description">{t("form.description")}</label>
        <textarea
          id="team-description"
          name="description"
          defaultValue={initial?.description ?? ""}
          {...fieldProps("description")}
          style={control}
        />
        {fieldError("description")}
      </p>
      <p>
        <label htmlFor="team-memberLimit">{t("form.memberLimit")}</label>
        <input
          id="team-memberLimit"
          name="memberLimit"
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={initial?.memberLimit ?? ""}
          {...fieldProps("memberLimit")}
          style={control}
        />
        {fieldError("memberLimit")}
      </p>
      {failed && (
        <p role="alert" style={errorColor}>
          {t("errors.GENERIC")}
        </p>
      )}
      <button type="submit" disabled={busy} style={touch}>
        {t("form.save")}
      </button>{" "}
      <button type="button" onClick={onCancel} style={touch}>
        {t("form.cancel")}
      </button>
    </form>
  );
}
