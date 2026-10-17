"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { ArtAsset } from "@/lib/art/route01-art";

type ArtImageProps = {
  art: ArtAsset | undefined;
  /** Accessible text, supplied by the caller from messages. */
  alt: string;
  /** Simple shape or coloured block shown when the image is missing or fails to load. */
  fallback: ReactNode;
  className?: string;
};

export function ArtImage({ art, alt, fallback, className }: ArtImageProps) {
  // 0: art.path, 1: art.fallbackPath (the earlier vector art), 2: the caller's fallback.
  const [stage, setStage] = useState(0);
  const fail = useCallback(
    () => setStage((s) => (s === 0 && art?.fallbackPath ? 1 : 2)),
    [art?.fallbackPath],
  );

  // The browser can fire `error` before React attaches onError (server-rendered <img>),
  // so a completed image with no pixels is treated as failed once it mounts.
  const checkLoaded = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth === 0) fail();
    },
    [fail],
  );

  if (!art || stage === 2) return <>{fallback}</>;
  const src = stage === 1 && art.fallbackPath ? art.fallbackPath : art.path;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static art, no optimisation needed
    <img key={src} ref={checkLoaded} src={src} alt={alt} className={className} onError={fail} />
  );
}
