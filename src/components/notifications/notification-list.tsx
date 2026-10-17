"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import { NotificationItem, type NotificationView } from "./notification-item";
import styles from "./notifications.module.css";

type Props = { initialItems: NotificationView[]; initialCursor: string | null };

/** The list: marks everything read once opened (items loaded now still show as new) and loads older pages. */
export function NotificationList({ initialItems, initialCursor }: Props) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [seen] = useState(() => new Set(initialItems.filter((i) => !i.readAt).map((i) => i.id)));

  useEffect(() => {
    if (seen.size === 0) return;
    clientFetch("/api/me/notifications/read", { method: "POST" })
      .then((res) => {
        if (res.ok) router.refresh();
      })
      .catch(() => {});
  }, [seen, router]);

  async function loadMore() {
    if (!cursor) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await clientFetch(`/api/me/notifications?cursor=${encodeURIComponent(cursor)}`);
      if (!res.ok) throw new Error("load failed");
      const page = (await res.json()) as { items: NotificationView[]; nextCursor: string | null };
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ul className={styles.list}>
        {items.map((item) => (
          <NotificationItem key={item.id} item={item} unread={seen.has(item.id)} />
        ))}
      </ul>
      {failed && (
        <p role="alert" className={styles.error}>
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
