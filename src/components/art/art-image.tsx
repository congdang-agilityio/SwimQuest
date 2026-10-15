"use client";

import { useState, type ReactNode } from "react";
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
  const [failed, setFailed] = useState(false);

  if (!art || failed) return <>{fallback}</>;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static art, no optimisation needed
    <img src={art.path} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}
