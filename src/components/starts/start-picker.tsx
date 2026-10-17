"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ArtImage } from "@/components/art/art-image";
import { Button, Card, Chip } from "@/components/ui";
import { landmarkArt } from "@/lib/art/route01-art";
import { clientFetch } from "@/lib/http/client-fetch";
import { formatVnDateTime } from "@/lib/time/vn";
import styles from "./start-picker.module.css";

/** Landmark thumbnail; decorative, so the radio's name stays the place name. */
function Thumb({ slug }: { slug: string }) {
  return (
    <span className={styles.thumb} aria-hidden="true">
      <ArtImage art={landmarkArt(slug)} alt="" fallback={null} />
    </span>
  );
}

type StartOption = { slug: string; nameKey: string };

type Props = {
  teamId: string;
  /** Start destinations (never the finish), in route order. */
  starts: readonly StartOption[];
  finish: StartOption | null;
  currentSlug: string | null;
  routeDistanceKm: number;
  /** ISO instant of the start lock. */
  lockAtIso: string;
  /** Members, and everyone after the lock, see the start without choosing. */
  readOnly: boolean;
  /** The start choice is locked: show the lock time instead of the captain-only note. */
  locked?: boolean;
};

export function StartPicker({
  teamId,
  starts,
  finish,
  currentSlug,
  routeDistanceKm,
  lockAtIso,
  readOnly,
  locked = false,
}: Props) {
  const t = useTranslations();
  const [selected, setSelected] = useState<string | null>(currentSlug);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(null);
    if (!selected) return setError(t("starts.picker.errors.NO_SELECTION"));
    setError(null);
    setBusy(true);
    try {
      const res = await clientFetch(`/api/teams/${encodeURIComponent(teamId)}/start`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destination: selected }),
      });
      if (res.ok) {
        const nameKey = starts.find((o) => o.slug === selected)?.nameKey;
        setSaved(
          t("starts.picker.saved", {
            name: nameKey ? t(nameKey) : selected,
            lockAt: formatVnDateTime(new Date(lockAtIso)),
          }),
        );
      } else {
        const body = (await res.json().catch(() => null)) as {
          error?: { code?: string; issues?: { lockedAt?: string }[] };
        } | null;
        const code = body?.error?.code;
        const lockedAt = body?.error?.issues?.[0]?.lockedAt;
        const lockedDate = lockedAt ? new Date(lockedAt) : null;
        if (code === "START_LOCKED" && lockedDate && !Number.isNaN(lockedDate.getTime()))
          setError(
            t("starts.picker.errors.START_LOCKED", { lockedAt: formatVnDateTime(lockedDate) }),
          );
        else if (code === "INVALID_START" || code === "FORBIDDEN")
          setError(t(`starts.picker.errors.${code}`));
        else setError(t("starts.picker.errors.GENERIC"));
      }
    } catch {
      setError(t("starts.picker.errors.GENERIC"));
    }
    setBusy(false);
  }

  const finishName = finish ? t(finish.nameKey) : null;
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby="start-picker-title"
      className={styles.form}
    >
      {locked ? (
        <Card className={styles.note}>
          {t("starts.picker.lockedSince", { lockedAt: formatVnDateTime(new Date(lockAtIso)) })}
        </Card>
      ) : (
        readOnly && <Card className={styles.note}>{t("starts.picker.readOnly")}</Card>
      )}
      {!locked && (
        <p className={styles.deadline}>
          <Chip tone="info">
            {t("starts.picker.deadline", { lockAt: formatVnDateTime(new Date(lockAtIso)) })}
          </Chip>
        </p>
      )}
      <fieldset
        className={styles.list}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "start-error" : undefined}
      >
        <legend className={styles.srOnly}>{t("starts.picker.legend")}</legend>
        {starts.map(({ slug, nameKey }) => (
          <label key={slug} className={styles.row}>
            <input
              type="radio"
              name="destination"
              value={slug}
              checked={selected === slug}
              disabled={readOnly}
              onChange={() => setSelected(slug)}
              className={styles.radio}
            />
            <Thumb slug={slug} />
            <span className={styles.name}>{t(nameKey)}</span>
          </label>
        ))}
        {finish && (
          <label className={`${styles.row} ${styles.finishRow}`}>
            <input
              type="radio"
              name="destination"
              value={finish.slug}
              disabled
              className={styles.radio}
            />
            <Thumb slug={finish.slug} />
            <span className={styles.finishText}>
              <span className={styles.name}>{finishName}</span>
              <Chip tone="info">{t("starts.picker.finish")}</Chip>
            </span>
            <span className={styles.pill}>
              {t("starts.picker.distance", { km: routeDistanceKm })}
            </span>
          </label>
        )}
      </fieldset>
      {finishName && (
        <p className={styles.finishNote}>
          {t("starts.picker.sameFinish", { finish: finishName })}
          <span>{t("starts.picker.sameFinishNote")}</span>
        </p>
      )}
      {error && (
        <p id="start-error" role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {saved && (
        <Card role="status" className={styles.saved}>
          {saved}
        </Card>
      )}
      {!readOnly && !locked && (
        <Button type="submit" variant="primary" block disabled={busy}>
          {t("starts.picker.confirm")}
        </Button>
      )}
      <a href="/team" className={styles.back}>
        {t("starts.picker.back")}
      </a>
    </form>
  );
}
