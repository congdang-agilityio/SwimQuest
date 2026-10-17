"use client";

import Link from "next/link";
import styles from "./ui.module.css";

export type TabItem = { id: string; label: string; href?: string };

type TabsProps = {
  items: readonly TabItem[];
  /** The id of the selected item. */
  value: string;
  /** Accessible name of the group. */
  label: string;
  /** For button segments (no href). Link segments navigate instead. */
  onChange?: (id: string) => void;
};

/**
 * Segmented control: the selected pill is the blue gradient ("Tạo đội" / "Tham gia đội",
 * "Tất cả" / "Đang diễn ra"). Link items get aria-current="page"; button items get aria-pressed.
 */
export function Tabs({ items, value, label, onChange }: TabsProps) {
  return (
    <ul className={styles.tabs} aria-label={label}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <li key={item.id}>
            {item.href ? (
              <Link
                href={item.href}
                className={styles.tab}
                aria-current={selected ? "page" : undefined}
              >
                {item.label}
              </Link>
            ) : (
              <button
                type="button"
                className={styles.tab}
                aria-pressed={selected}
                onClick={() => onChange?.(item.id)}
              >
                {item.label}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
