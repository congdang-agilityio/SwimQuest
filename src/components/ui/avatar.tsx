import styles from "./ui.module.css";

type AvatarProps = {
  /** Display name; its initials show when there is no image. */
  name: string;
  src?: string | null;
  /** Diameter in px (mockup: 40 in lists, 64 on the home header). */
  size?: number;
  /** Set when the name is already shown next to the avatar. */
  decorative?: boolean;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Avatar({ name, src, size = 40, decorative = false }: AvatarProps) {
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      // Initials are drawn by CSS so they never leak into the text of a parent link or summary.
      data-initials={src ? undefined : initials(name)}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- user avatars are small and already sized
        <img src={src} alt="" />
      )}
    </span>
  );
}
