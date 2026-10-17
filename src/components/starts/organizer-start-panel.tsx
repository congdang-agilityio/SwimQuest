"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import styles from "./organizer-start-panel.module.css";
import pickerStyles from "./start-picker.module.css";
import { StartOriginLabel } from "./team-start-card";
import { ArtImage } from "@/components/art/art-image";
import { Button } from "@/components/ui";
import { landmarkArt } from "@/lib/art/route01-art";
import { clientFetch } from "@/lib/http/client-fetch";
import { formatVnDateTime } from "@/lib/time/vn";

type StartOption = { slug: string; nameKey: string };

type Props = {
  teamId: string;
  /** Start destinations (never the finish), in route order. */
  starts: readonly StartOption[];
  currentSlug: string | null;
  /** Who set the current start; null when none is set. */
  setBy: "CAPTAIN" | "ORGANIZER" | "AUTOMATIC" | null;
  /** ISO instant the current start was set. */
  setAtIso: string | null;
  /** ISO instant of the start lock. */
  lockAtIso: string;
  locked: boolean;
};

function Thumb({ slug }: { slug: string | null }) {
  return (
    <span className={pickerStyles.thumb} aria-hidden="true">
      {slug && <ArtImage art={landmarkArt(slug)} alt="" fallback={null} />}
    </span>
  );
}

/** Organizer's per-team start action: shows the start and, before the lock, lets them set it. */
export function OrganizerStartPanel({
  teamId,
  starts,
  currentSlug,
  setBy,
  setAtIso,
  lockAtIso,
  locked,
}: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(currentSlug);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameOf = (slug: string | null) => {
    const key = starts.find((s) => s.slug === slug)?.nameKey;
    return key ? t(key) : null;
  };
  const lockAt = formatVnDateTime(new Date(lockAtIso));
  const currentName = nameOf(currentSlug);
  // Replacing the captain's own choice needs a confirmation naming it.
  const overridesCaptain = setBy === "CAPTAIN" && selected !== currentSlug;

  function close() {
    setOpen(false);
    setConfirming(false);
    setError(null);
    setSelected(currentSlug);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await clientFetch(`/api/teams/${encodeURIComponent(teamId)}/organizer-start`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: selected }),
      });
      if (res.ok) {
        const name = nameOf(selected) ?? "";
        setSaved(t("starts.organizer.saved", { name }));
        setOpen(false);
        setConfirming(false);
        router.refresh();
      } else {
        const body = (await res.json().catch(() => null)) as {
          error?: { code?: string; issues?: { lockedAt?: string }[] };
        } | null;
        const code = body?.error?.code;
        const lockedAt = body?.error?.issues?.[0]?.lockedAt;
        const lockedDate = lockedAt ? new Date(lockedAt) : null;
        setConfirming(false);
        if (code === "START_LOCKED" && lockedDate && !Number.isNaN(lockedDate.getTime())) {
          setError(
            t("starts.organizer.errors.START_LOCKED", { lockedAt: formatVnDateTime(lockedDate) }),
          );
          router.refresh();
        } else if (code === "INVALID_START") setError(t("starts.organizer.errors.INVALID_START"));
        else setError(t("starts.organizer.errors.GENERIC"));
      }
    } catch {
      setConfirming(false);
      setError(t("starts.organizer.errors.GENERIC"));
    }
    setBusy(false);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(null);
    if (!selected) return setError(t("starts.organizer.errors.NO_SELECTION"));
    setError(null);
    if (overridesCaptain) setConfirming(true);
    else void save();
  }

  return (
    <section aria-labelledby="organizer-start-title" className={styles.panel}>
      <div className={styles.head}>
        <Thumb slug={currentSlug} />
        <div className={styles.headText}>
          <h2 id="organizer-start-title" className={styles.title}>
            {t("starts.organizer.title")}
          </h2>
          <p className={styles.current}>{currentName ?? t("starts.card.notChosen")}</p>
        </div>
      </div>
      {currentName && setBy === "AUTOMATIC" && setAtIso && (
        <p className={styles.note}>
          <StartOriginLabel setAtIso={setAtIso} />
        </p>
      )}
      {currentName && (setBy === "ORGANIZER" || setBy === "CAPTAIN") && (
        <p className={styles.note}>
          {t(`starts.originBy.${setBy === "ORGANIZER" ? "organizer" : "captain"}`)}
        </p>
      )}
      {!currentName && !locked && (
        <p className={styles.note}>{t("starts.organizer.notChosen", { deadline: lockAt })}</p>
      )}
      {locked && (
        <p className={styles.note}>{t("starts.organizer.lockedSince", { lockedAt: lockAt })}</p>
      )}
      {saved && (
        <p role="status" className={styles.note}>
          {saved}
        </p>
      )}
      {error && (
        <p role="alert" className={pickerStyles.error}>
          {error}
        </p>
      )}
      {!locked &&
        (open ? (
          <form onSubmit={onSubmit} noValidate className={pickerStyles.form}>
            <fieldset className={pickerStyles.list}>
              <legend className={pickerStyles.srOnly}>{t("starts.organizer.legend")}</legend>
              {starts.map(({ slug, nameKey }) => (
                <label key={slug} className={pickerStyles.row}>
                  <input
                    type="radio"
                    name="destination"
                    value={slug}
                    checked={selected === slug}
                    onChange={() => {
                      setSelected(slug);
                      setConfirming(false);
                    }}
                    className={pickerStyles.radio}
                  />
                  <Thumb slug={slug} />
                  <span className={pickerStyles.name}>{t(nameKey)}</span>
                </label>
              ))}
            </fieldset>
            {confirming ? (
              <div
                role="alertdialog"
                aria-label={t("starts.organizer.overrideTitle")}
                className={styles.confirm}
              >
                <p className={styles.confirmTitle}>{t("starts.organizer.overrideTitle")}</p>
                <p className={styles.confirmBody}>
                  {t("starts.organizer.overrideBody", {
                    name: currentName ?? "",
                    newName: nameOf(selected) ?? "",
                  })}
                </p>
                <div className={styles.actions}>
                  <Button type="button" disabled={busy} onClick={() => void save()}>
                    {t("starts.organizer.overrideYes")}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
                    {t("starts.organizer.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <Button type="submit" disabled={busy}>
                  {t("starts.organizer.save")}
                </Button>
                <Button type="button" variant="secondary" onClick={close}>
                  {t("starts.organizer.cancel")}
                </Button>
              </div>
            )}
          </form>
        ) : (
          <>
            <p className={styles.note}>{t("starts.organizer.deadline", { deadline: lockAt })}</p>
            <Button
              variant="secondary"
              block
              onClick={() => {
                setSaved(null);
                setError(null);
                setSelected(currentSlug);
                setOpen(true);
              }}
            >
              {currentSlug ? t("starts.organizer.change") : t("starts.organizer.choose")}
            </Button>
          </>
        ))}
    </section>
  );
}
