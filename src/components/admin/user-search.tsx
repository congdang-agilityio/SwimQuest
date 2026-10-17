"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Avatar, Button, Chip, Field, SectionHeader } from "@/components/ui";
import { clientFetch } from "@/lib/http/client-fetch";
import styles from "./admin.module.css";
import { statusTone } from "./status-tone";

export type AdminUser = {
  id: string;
  displayName: string;
  email: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETION_PENDING" | "DELETED";
  isPlatformAdmin: boolean;
};

type Page = { items: AdminUser[]; nextCursor: string | null };

/** Admin user search: name or email, 20 per page, "Show more" follows the cursor. */
export function UserSearch() {
  const t = useTranslations("admin.users");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AdminUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0); // ignore answers to an older search

  const load = useCallback(async (q: string, after: string | null) => {
    const run = ++latest.current;
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (after) params.set("cursor", after);
    const res = await clientFetch(`/api/admin/users?${params}`).catch(() => null);
    const page: Page | null = res?.ok ? await res.json().catch(() => null) : null;
    if (run !== latest.current) return;
    if (!page) setFailed(true);
    else {
      setItems((prev) => (after ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(query, null);
  }, [load, query]);

  return (
    <section aria-labelledby="users-title" className={styles.panel}>
      <SectionHeader id="users-title">{t("resultsTitle")}</SectionHeader>
      <div className={styles.panelBody}>
        <form
          role="search"
          className={styles.searchRow}
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(input.trim());
          }}
        >
          <Field
            id="user-search"
            type="search"
            label={t("searchLabel")}
            value={input}
            maxLength={100}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" disabled={loading}>
            {t("searchButton")}
          </Button>
        </form>
        {failed && (
          <div className={styles.confirm}>
            <p role="alert" className={styles.error}>
              {t("error")}
            </p>
            <Button variant="secondary" onClick={() => void load(query, cursor)}>
              {t("retry")}
            </Button>
          </div>
        )}
        {!loading && !failed && items.length === 0 && <p className={styles.muted}>{t("empty")}</p>}
        <ul className={styles.list}>
          {items.map((u) => (
            <li key={u.id}>
              <Link
                href={`/admin/users/${u.id}`}
                className={styles.row}
                aria-label={t("open", { name: u.displayName })}
              >
                <Avatar name={u.displayName} decorative />
                <span className={styles.rowText}>
                  <span className={styles.name}>{u.displayName}</span>
                  <span className={styles.email}>{u.email}</span>
                  <span className={styles.chips}>
                    <Chip tone={statusTone(u.status)}>{t(`status.${u.status}`)}</Chip>
                    <Chip tone={u.isPlatformAdmin ? "gold" : "neutral"}>
                      {t(u.isPlatformAdmin ? "role.admin" : "role.player")}
                    </Chip>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {loading && <p className={styles.muted}>{t("loading")}</p>}
        {cursor && !loading && (
          <Button variant="secondary" onClick={() => void load(query, cursor)}>
            {t("loadMore")}
          </Button>
        )}
      </div>
    </section>
  );
}
