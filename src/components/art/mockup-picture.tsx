import type { ReactNode } from "react";
import { mockupArt } from "@/lib/art/mockup-art";
import { SafeImg } from "./safe-img";

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
  /** Rendered when the key is not in the registry or the file fails to load. */
  fallback?: ReactNode;
};

/**
 * A registry image as <picture>: WebP first, PNG fallback, optional art-directed crops. A missing
 * file shows `fallback` (nothing by default) instead of a broken image.
 */
export function MockupPicture({ artKey, sources = [], alt, className, eager, fallback }: Props) {
  const art = mockupArt(artKey);
  if (!art) return <>{fallback ?? null}</>;
  const crops = sources.flatMap((s) => {
    const a = mockupArt(s.artKey);
    return a ? [{ media: s.media, srcSet: a.webp }] : [];
  });
  return (
    <SafeImg
      src={art.file}
      webp={art.webp}
      sources={crops}
      alt={alt}
      width={art.width}
      height={art.height}
      className={className}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fallback={fallback}
    />
  );
}
