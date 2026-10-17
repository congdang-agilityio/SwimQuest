"use client";

import { useCallback, useState, type ImgHTMLAttributes, type ReactNode } from "react";

type SafeImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "children"> & {
  /** The image URL, or the PNG when `webp` is given. */
  src: string;
  /** Optional WebP copy: renders a <picture> with WebP first and `src` as the fallback. */
  webp?: string;
  /** Art-directed crops for media queries, first match wins (WebP). */
  sources?: { media: string; srcSet: string }[];
  /** Shown instead of the image when it fails to load (nothing by default). */
  fallback?: ReactNode;
};

/**
 * A static image that never shows as broken: when the file is missing or fails, the fallback is
 * rendered instead (nothing by default). Like ArtImage, a server-rendered <img> can fail before
 * React attaches `onError`, so a completed image with no pixels counts as failed on mount.
 */
export function SafeImg({ src, webp, sources, fallback = null, alt = "", ...rest }: SafeImgProps) {
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);
  const checkLoaded = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth === 0) fail();
    },
    [fail],
  );
  if (failed) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element -- static art, no optimisation needed
  const img = <img ref={checkLoaded} src={src} alt={alt} onError={fail} {...rest} />;
  if (!webp && !sources?.length) return img;
  return (
    <picture>
      {sources?.map((s) => (
        <source key={s.srcSet} media={s.media} type="image/webp" srcSet={s.srcSet} />
      ))}
      {webp && <source type="image/webp" srcSet={webp} />}
      {img}
    </picture>
  );
}
