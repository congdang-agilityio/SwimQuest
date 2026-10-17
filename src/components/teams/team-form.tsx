"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { EMBLEM_KEYS } from "@/lib/emblems";
import { clientFetch } from "@/lib/http/client-fetch";
import { parseTeamInput, type TeamErrorCode, type TeamField } from "@/lib/validation/team";
import { Button, Card, Field, TextareaField } from "@/components/ui";
import { TeamEmblem } from "./team-emblem";
import styles from "./team-setup.module.css";

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
  /** "captain" edits name, emblem and description only: no member limit field or value. */
  mode?: "organizer" | "captain";
  onSaved: () => void;
  onCancel: () => void;
};

type FieldError = TeamErrorCode | "LIMIT_BELOW_MEMBERS";
type Errors = Partial<Record<TeamField, FieldError>>;

export function TeamForm({ action, initial, mode = "organizer", onSaved, onCancel }: Props) {
  const t = useTranslations("teams");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [emblem, setEmblem] = useState(initial?.emblemKey ?? "");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const captain = mode === "captain";
    const rawLimit = String(form.get("memberLimit") ?? "").trim();
    const parsed = parseTeamInput({
      name: form.get("name"),
      emblemKey: emblem,
      description: form.get("description"),
      // The API needs a JSON number, never the string from the input.
      memberLimit: captain ? 1 : rawLimit === "" ? Number.NaN : Number(rawLimit),
    });
    setFailed(false);
    setErrors(parsed.ok ? {} : parsed.errors);
    if (!parsed.ok) return;
    setBusy(true);
    try {
      const res = await clientFetch(action.url, {
        method: action.method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          captain
            ? {
                name: parsed.data.name,
                emblemKey: parsed.data.emblemKey,
                description: parsed.data.description,
              }
            : parsed.data,
        ),
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

  const fieldError = (name: TeamField) => (errors[name] ? t(`errors.${errors[name]}`) : undefined);

  return (
    <Card>
      <form
        onSubmit={onSubmit}
        noValidate
        aria-labelledby="team-form-title"
        className={styles.form}
      >
        <h3 id="team-form-title" className={styles.formTitle}>
          {t(initial ? "form.editTitle" : "form.addTitle")}
        </h3>
        <Field
          id="team-name"
          name="name"
          type="text"
          label={t("form.name")}
          defaultValue={initial?.name ?? ""}
          error={fieldError("name")}
        />
        <fieldset
          className={styles.emblems}
          aria-invalid={errors.emblemKey ? true : undefined}
          aria-describedby={errors.emblemKey ? "team-emblemKey-error" : undefined}
        >
          <legend className={styles.legend}>{t("form.emblem")}</legend>
          <div className={styles.tiles}>
            {EMBLEM_KEYS.map((key) => (
              <label key={key} className={styles.tile}>
                <input
                  type="radio"
                  name="emblemKey"
                  value={key}
                  checked={emblem === key}
                  onChange={() => setEmblem(key)}
                  className={styles.tileRadio}
                />
                <TeamEmblem emblemKey={key} size={48} alt={t(`emblems.${key}`)} />
              </label>
            ))}
          </div>
          {errors.emblemKey && (
            <span id="team-emblemKey-error" role="alert" className={styles.error}>
              {fieldError("emblemKey")}
            </span>
          )}
        </fieldset>
        <TextareaField
          id="team-description"
          name="description"
          label={t("form.description")}
          defaultValue={initial?.description ?? ""}
          error={fieldError("description")}
          rows={3}
        />
        {mode === "organizer" && (
          <Field
            id="team-memberLimit"
            name="memberLimit"
            type="number"
            inputMode="numeric"
            min={1}
            label={t("form.memberLimit")}
            defaultValue={initial?.memberLimit ?? ""}
            error={fieldError("memberLimit")}
          />
        )}
        {failed && (
          <p role="alert" className={styles.error}>
            {t("errors.GENERIC")}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" disabled={busy} block>
            {t("form.save")}
          </Button>
          <Button variant="ghost" onClick={onCancel} block>
            {t("form.cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
