"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button, Tabs, controlClass } from "@/components/ui";
import { FIND_FILTERS, findHref, type FindFilter } from "@/lib/tournaments/find-params";
import styles from "./find.module.css";

/** Search box and status pills. The address is the state, so results can be shared and reloaded. */
export function FindFilters({ q, filter }: { q: string; filter: FindFilter }) {
  const t = useTranslations("find");
  const router = useRouter();
  const [text, setText] = useState(q);

  function submit(e: FormEvent) {
    e.preventDefault();
    router.push(findHref(text.trim(), filter));
  }

  return (
    <div className={styles.filters}>
      <form className={styles.search} role="search" onSubmit={submit}>
        <label htmlFor="find-q" className={styles.searchLabel}>
          {t("searchLabel")}
        </label>
        <input
          id="find-q"
          type="search"
          name="q"
          className={controlClass}
          value={text}
          maxLength={100}
          placeholder={t("searchPlaceholder")}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" size="sm">
          {t("searchButton")}
        </Button>
      </form>
      <div className={styles.pills}>
        <Tabs
          label={t("filterLabel")}
          value={filter}
          items={FIND_FILTERS.map((id) => ({
            id,
            label: t(`filter.${id}`),
            href: findHref(q, id),
          }))}
        />
      </div>
    </div>
  );
}
