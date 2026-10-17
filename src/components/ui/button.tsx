import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import styles from "./ui.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "dark";
type Common = {
  /** primary: blue gradient pill (main action). secondary: white pill. ghost: outline. dark: black pill. */
  variant?: ButtonVariant;
  /** Full width, as the mockup's main actions ("Tạo giải đấu", "Gửi hoạt động"). */
  block?: boolean;
  size?: "md" | "sm";
};

export function buttonClass({ variant = "primary", block, size = "md" }: Common, extra?: string) {
  return [
    styles.button,
    styles[variant],
    block && styles.block,
    size === "sm" && styles.small,
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant,
  block,
  size,
  className,
  type = "button",
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buttonClass({ variant, block, size }, className)} {...rest} />
  );
}

/** A link that looks like a Button (navigation, not an action). */
export function ButtonLink({
  variant,
  block,
  size,
  className,
  href,
  ...rest
}: Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <Link href={href} className={buttonClass({ variant, block, size }, className)} {...rest} />
  );
}
