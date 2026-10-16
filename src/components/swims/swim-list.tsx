"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { EmptyState } from "@/components/states/empty-state";
import * as f from "@/lib/format/swim";
import { utcToVnParts } from "@/lib/time/vn";
import type { MySwimListItem, MySwimsPage } from "@/server/swims/my-swims";

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
      const res = await fetch(`/api/me/swims?cursor=${encodeURIComponent(cursor)}`);
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
    return <EmptyState message={t("empty")} action={{ label: t("add"), href: "/connect" }} />;
  }
  return (
    <>
      <ul>
        {items.map((s) => {
          const { date, time } = utcToVnParts(new Date(s.startedAt));
          return (
            <li key={s.id}>
              <Link href={`/swims/${s.id}`}>
                {f.formatVnDateTime(date, time)} · {f.formatDistance(s.distanceM, locale)} ·{" "}
                {f.formatDuration(s.durationS)}
              </Link>
            </li>
          );
        })}
      </ul>
      {failed && <p role="alert">{t("error")}</p>}
      {cursor && (
        <button type="button" onClick={loadMore} disabled={busy}>
          {busy ? t("loading") : t("more")}
        </button>
      )}
    </>
  );
}
