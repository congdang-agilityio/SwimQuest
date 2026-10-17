"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Avatar, Button, Field, SelectField, TextareaField } from "@/components/ui";
import { DEFAULT_AVATAR_KEYS } from "@/lib/default-avatars";
import { clientFetch } from "@/lib/http/client-fetch";
import { defaultAvatarSrc, imageSrc } from "@/lib/profile-avatar";
import { REGIONS } from "@/lib/regions";
import { goalDistanceText, parseGoalDistance } from "@/lib/goal-distance";
import { BIO_MAX, DISCIPLINES, DISPLAY_NAME_MAX, GOALS_MAX } from "@/lib/validation/profile";
import type { MyProfile } from "@/server/profile/my-profile";
import { useUnsavedChanges } from "@/lib/hooks/use-unsaved-changes";
import { LeaveConfirm } from "./leave-confirm";
import styles from "./profile-edit-form.module.css";

type Props = {
  profile: MyProfile;
  onSaved: (profile: MyProfile) => void;
  onCancel: () => void;
};
type Kind = "AVATAR" | "COVER";

/** My Profile in edit mode. Server error codes are shown next to the field they belong to. */
export function ProfileEditForm({ profile, onSaved, onCancel }: Props) {
  const t = useTranslations("profile.edit");
  const te = useTranslations("profile.defaults");
  const tr = useTranslations("profile.errors");
  const td = useTranslations("profile.disciplines");
  const locale = useLocale() === "en" ? "en" : "vi";
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [regionCode, setRegionCode] = useState(profile.regionCode ?? "");
  const [goalsText, setGoalsText] = useState(profile.goalsText ?? "");
  const [goalDistance, setGoalDistance] = useState(goalDistanceText(profile.goalDistanceM, locale));
  const [disciplines, setDisciplines] = useState<string[]>(profile.disciplines);
  const [avatarImageId, setAvatarImageId] = useState(profile.avatarImageId);
  const [avatarDefaultKey, setAvatarDefaultKey] = useState(profile.avatarDefaultKey);
  const [coverImageId, setCoverImageId] = useState(profile.coverImageId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState(0);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("offline", sync);
    window.addEventListener("online", sync);
    return () => {
      window.removeEventListener("offline", sync);
      window.removeEventListener("online", sync);
    };
  }, []);
  const [uploading, setUploading] = useState<Kind | null>(null);

  const dirty =
    displayName !== profile.displayName ||
    bio !== (profile.bio ?? "") ||
    regionCode !== (profile.regionCode ?? "") ||
    goalsText !== (profile.goalsText ?? "") ||
    goalDistance !== goalDistanceText(profile.goalDistanceM, locale) ||
    disciplines.length !== profile.disciplines.length ||
    disciplines.some((d) => !profile.disciplines.includes(d)) ||
    avatarImageId !== profile.avatarImageId ||
    avatarDefaultKey !== profile.avatarDefaultKey ||
    coverImageId !== profile.coverImageId;
  const guard = useUnsavedChanges(dirty && !saved);

  const message = (code?: string, max?: number) =>
    code ? tr(KNOWN_ERRORS.has(code) ? code : "GENERIC", { max: max ?? 0 }) : undefined;
  const avatarPreview = imageSrc(avatarImageId) ?? defaultAvatarSrc(avatarDefaultKey);

  async function upload(kind: Kind, event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const field = kind === "AVATAR" ? "avatarImageId" : "coverImageId";
    setErrors((e) => ({ ...e, [field]: "" }));
    setUploading(kind);
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("file", file);
      const res = await clientFetch("/api/images", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.id) {
        if (kind === "AVATAR") {
          setAvatarImageId(json.id);
          setAvatarDefaultKey(null);
        } else setCoverImageId(json.id);
      } else {
        const code = json?.error?.fields?.file ?? json?.error?.code;
        setErrors((e) => ({ ...e, [field]: code ?? "GENERIC" }));
      }
    } catch {
      setErrors((e) => ({ ...e, [field]: "GENERIC" }));
    }
    setUploading(null);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    return save();
  }

  /** Sends the values as they stand now; a failed save leaves every field as typed, so Retry resends them. */
  async function save() {
    setErrors({});
    const goalDistanceM = goalDistance.trim() === "" ? null : parseGoalDistance(goalDistance);
    if (goalDistance.trim() !== "" && goalDistanceM === null) {
      setErrors({ goalDistanceM: "GOAL_DISTANCE_INVALID" });
      return;
    }
    if (!navigator.onLine) {
      setErrors({ form: "OFFLINE" });
      return;
    }
    setBusy(true);
    try {
      const res = await clientFetch("/api/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          bio: bio.trim() === "" ? null : bio,
          regionCode: regionCode || null,
          goalsText: goalsText.trim() === "" ? null : goalsText,
          goalDistanceM,
          disciplines,
          avatarImageId,
          avatarDefaultKey: avatarImageId ? undefined : avatarDefaultKey,
          coverImageId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.profile) {
        setSaved(true);
        onSaved(json.profile as MyProfile);
        return;
      }
      const fields = json?.error?.fields as Record<string, string> | undefined;
      setStatus(res.status);
      setErrors(
        fields && Object.keys(fields).length
          ? fields
          : { form: res.status >= 500 ? "SERVER" : "GENERIC" },
      );
    } catch {
      setErrors({ form: navigator.onLine ? "GENERIC" : "OFFLINE" });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form} aria-label={t("title")}>
      <Field
        id="profile-name"
        name="displayName"
        label={t("displayName")}
        hint={t("displayNameHint", { max: DISPLAY_NAME_MAX })}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        autoComplete="nickname"
        error={message(errors.displayName, DISPLAY_NAME_MAX)}
      />

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t("avatar")}</legend>
        <div className={styles.avatarRow}>
          <Avatar name={displayName || "?"} src={avatarPreview} size={64} decorative />
          <label className={styles.upload}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={styles.file}
              onChange={(e) => upload("AVATAR", e)}
            />
            {uploading === "AVATAR" ? t("uploading") : t("avatarUpload")}
          </label>
          {(avatarImageId || avatarDefaultKey) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAvatarImageId(null);
                setAvatarDefaultKey(null);
              }}
            >
              {t("avatarRemove")}
            </Button>
          )}
        </div>
        <p className={styles.hint}>{t("uploadHint")}</p>
        <p className={styles.sub}>{t("avatarDefaults")}</p>
        <div className={styles.picker} role="group" aria-label={t("avatarDefaults")}>
          {DEFAULT_AVATAR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={styles.choice}
              aria-pressed={!avatarImageId && avatarDefaultKey === key}
              aria-label={te(key)}
              onClick={() => {
                setAvatarDefaultKey(key);
                setAvatarImageId(null);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static default art */}
              <img src={defaultAvatarSrc(key) ?? ""} alt="" />
            </button>
          ))}
        </div>
        {(errors.avatarImageId || errors.avatarDefaultKey) && (
          <span role="alert" className={styles.error}>
            {message(errors.avatarImageId || errors.avatarDefaultKey)}
          </span>
        )}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t("cover")}</legend>
        {imageSrc(coverImageId) && (
          // eslint-disable-next-line @next/next/no-img-element -- the player's uploaded cover
          <img src={imageSrc(coverImageId) ?? ""} alt="" className={styles.coverPreview} />
        )}
        <div className={styles.avatarRow}>
          <label className={styles.upload}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={styles.file}
              onChange={(e) => upload("COVER", e)}
            />
            {uploading === "COVER" ? t("uploading") : t("coverUpload")}
          </label>
          {coverImageId && (
            <Button variant="ghost" size="sm" onClick={() => setCoverImageId(null)}>
              {t("coverRemove")}
            </Button>
          )}
        </div>
        <p className={styles.hint}>{t("uploadHint")}</p>
        {errors.coverImageId && (
          <span role="alert" className={styles.error}>
            {message(errors.coverImageId)}
          </span>
        )}
      </fieldset>

      <TextareaField
        id="profile-bio"
        name="bio"
        label={t("bio")}
        hint={`${t("bioHint", { max: BIO_MAX })} ${t("bioCounter", { count: bio.length, max: BIO_MAX })}`}
        value={bio}
        rows={4}
        onChange={(e) => setBio(e.target.value)}
        error={message(errors.bio, BIO_MAX)}
      />

      <SelectField
        id="profile-region"
        name="regionCode"
        label={t("region")}
        hint={t("regionHint")}
        value={regionCode}
        onChange={(e) => setRegionCode(e.target.value)}
        error={message(errors.regionCode)}
      >
        <option value="">{t("regionNone")}</option>
        {REGIONS.map((r) => (
          <option key={r.code} value={r.code}>
            {r[locale]}
          </option>
        ))}
      </SelectField>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t("swimming")}</legend>
        <TextareaField
          id="profile-goals"
          name="goalsText"
          label={t("goals")}
          hint={`${t("goalsHint", { max: GOALS_MAX })} ${t("bioCounter", { count: goalsText.length, max: GOALS_MAX })}`}
          placeholder={t("goalsPlaceholder")}
          value={goalsText}
          rows={3}
          onChange={(e) => setGoalsText(e.target.value)}
          error={message(errors.goalsText, GOALS_MAX)}
        />
        <Field
          id="profile-goal-distance"
          name="goalDistance"
          label={t("goalDistance")}
          hint={t("goalDistanceHint")}
          placeholder={t("goalDistancePlaceholder")}
          value={goalDistance}
          inputMode="decimal"
          autoComplete="off"
          onChange={(e) => setGoalDistance(e.target.value)}
          error={message(errors.goalDistanceM)}
        />
        <p className={styles.sub} id="profile-disciplines-label">
          {t("disciplines")}
        </p>
        <div
          className={styles.disciplines}
          role="group"
          aria-labelledby="profile-disciplines-label"
        >
          {DISCIPLINES.map((d) => (
            <button
              key={d}
              type="button"
              className={styles.toggle}
              aria-pressed={disciplines.includes(d)}
              onClick={() =>
                setDisciplines((list) =>
                  list.includes(d) ? list.filter((x) => x !== d) : [...list, d],
                )
              }
            >
              {td(d)}
            </button>
          ))}
        </div>
        <p className={styles.hint}>{t("disciplinesHint")}</p>
        {errors.disciplines && (
          <span role="alert" className={styles.error}>
            {message(errors.disciplines)}
          </span>
        )}
      </fieldset>

      {offline && !errors.form && (
        <p role="status" className={styles.notice}>
          {t("offlineNotice")}
        </p>
      )}
      {errors.form && (
        <div role="alert" className={styles.formError}>
          <p className={styles.error}>
            {errors.form === "SERVER" ? tr("SERVER", { status }) : message(errors.form)}
          </p>
          <Button variant="secondary" size="sm" onClick={save} disabled={busy}>
            {t("retry")}
          </Button>
        </div>
      )}
      <div className={styles.actions}>
        <Button type="submit" disabled={busy || uploading !== null}>
          {busy ? t("saving") : t("save")}
        </Button>
        <Button variant="ghost" onClick={() => guard.requestLeave(onCancel)} disabled={busy}>
          {t("cancel")}
        </Button>
      </div>
      {guard.pending && <LeaveConfirm onKeep={guard.keepEditing} onDiscard={guard.discard} />}
    </form>
  );
}

const KNOWN_ERRORS: ReadonlySet<string> = new Set([
  "DISPLAY_NAME_REQUIRED",
  "DISPLAY_NAME_TOO_LONG",
  "BIO_TOO_LONG",
  "GOALS_TOO_LONG",
  "GOAL_DISTANCE_INVALID",
  "DISCIPLINE_UNKNOWN",
  "REGION_UNKNOWN",
  "AVATAR_UNKNOWN",
  "IMAGE_INVALID",
  "UNKNOWN_FIELD",
  "IMAGE_TOO_LARGE",
  "IMAGE_TYPE_NOT_ALLOWED",
  "OFFLINE",
  "SERVER",
]);
