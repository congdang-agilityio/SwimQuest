import type { HTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";

type CardProps = HTMLAttributes<HTMLElement> & {
  /** light: foam card on any background (default). dark: translucent navy card on the page. */
  tone?: "light" | "dark";
  as?: "div" | "section" | "article";
};

export function Card({ tone = "light", as: Tag = "div", className, ...rest }: CardProps) {
  return (
    <Tag
      data-surface={tone === "light" ? "light" : undefined}
      className={[tone === "light" ? styles.card : styles.cardDark, className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  );
}

/** Uppercase navy band heading a desktop panel ("DANH SÁCH GIẢI ĐẤU"). */
export function SectionHeader({
  children,
  level = 2,
  id,
}: {
  children: ReactNode;
  level?: 2 | 3;
  id?: string;
}) {
  const Tag = level === 2 ? "h2" : "h3";
  return (
    <Tag id={id} className={styles.sectionHeader}>
      {children}
    </Tag>
  );
}
