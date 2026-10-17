import type { ReactNode } from "react";
import { mockupArt } from "@/lib/art/mockup-art";

type Props = {
  /** Registry key of the default image, e.g. `scenes/hero-swimmers-4x3`. */
  artKey: string;
  /** Art direction: other crops for media queries, first match wins. */
  sources?: { media: string; artKey: string }[];
  /** Accessible text from messages, or "" when decorative. */
  alt: string;
  className?: string;
  /** Load at once (above the fold) instead of lazily. */
  eager?: boolean;
  /** Rendered when the key is not in the registry. */
  fallback?: ReactNode;
};

/** A registry image as <picture>: WebP first, PNG fallback, optional art-directed crops. */
export function MockupPicture({ artKey, sources = [], alt, className, eager, fallback }: Props) {
  const art = mockupArt(artKey);
  if (!art) return <>{fallback ?? null}</>;
  return (
    <picture>
      {sources.map((s) => {
        const a = mockupArt(s.artKey);
        return a ? (
          <source key={s.artKey} media={s.media} type="image/webp" srcSet={a.webp} />
        ) : null;
      })}
      <source type="image/webp" srcSet={art.webp} />
      <img
        src={art.file}
        alt={alt}
        width={art.width}
        height={art.height}
        className={className}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
    </picture>
  );
}
