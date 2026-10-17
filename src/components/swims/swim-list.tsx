"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { StateCard } from "@/components/states/state-card";
import { Button, ButtonLink } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import * as f from "@/lib/format/swim";
import { utcToVnParts } from "@/lib/time/vn";
import type { MySwimListItem, MySwimsPage } from "@/server/swims/my-swims";
import styles from "./swims.module.css";

type Props = { initialItems: MySwimListItem[]; initialCursor: string | null };

export function SwimList({ initialItems, initialCursor }: Props) {
  const t = useTranslations("my-swims");
  const locale = useLocale() === "en" ? "en" : "vi";
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    if (!cursor || busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await clientFetch(`/api/me/swims?cursor=${encodeURIComponent(cursor)}`);
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as MySwimsPage;
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (items.length === 0) {
    return (
      <StateCard art="items/goggles" titleId="swims-empty" title={t("empty")} body={t("emptyBody")}>
        <ButtonLink href="/connect" variant="primary" block>
          {t("add")}
        </ButtonLink>
      </StateCard>
    );
  }
  return (
    <>
      <ul className={styles.list}>
        {items.map((s) => {
          const { date, time } = utcToVnParts(new Date(s.startedAt));
          return (
            <li key={s.id}>
              <Link href={`/swims/${s.id}`} className={styles.listRow}>
                <span className={styles.listMain}>
                  <span className={styles.listDate}>{f.formatVnDateTime(date, time)}</span>
                  <span className={styles.listDuration}>{f.formatDuration(s.durationS)}</span>
                </span>
                <strong className={styles.listDistance}>
                  {f.formatDistance(s.distanceM, locale)}
                </strong>
                <svg
                  className={styles.chevron}
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M9 5l7 7-7 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
      {failed && (
        <p role="alert" className={styles.listAlert}>
          {t("error")}
        </p>
      )}
      {cursor && (
        <Button variant="secondary" block onClick={loadMore} disabled={busy}>
          {busy ? t("loading") : t("more")}
        </Button>
      )}
    </>
  );
}
