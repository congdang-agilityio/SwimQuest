"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { MockupAsset } from "@/lib/art/mockup-art";
import { reportTelemetry } from "@/lib/telemetry/report";

/**
 * Phones and portrait tablets (the map is under ~560 px wide next to the side nav) get the tall
 * map art; the same breakpoint as the portrait anchors in voyage.module.css.
 */
export const PORTRAIT_MEDIA = "(max-width: 1023px)";

type Props = {
  landscape: MockupAsset | undefined;
  portrait: MockupAsset | undefined;
  className?: string;
  /** Shown when the art is missing or fails to load. */
  fallback: ReactNode;
};

/**
 * The map art: the tall variant below 1024 px, the wide one from 1024 px, WebP first. If the WebP
 * fails, the PNG copies are tried, then the caller's fallback.
 */
export function MapArt({ landscape, portrait, className, fallback }: Props) {
  // 0: WebP, 1: PNG, 2: the caller's fallback.
  const [stage, setStage] = useState(0);
  const fail = useCallback(() => {
    if (landscape) {
      reportTelemetry(`asset:${landscape.webp}`, { kind: "ASSET_FAILURE", path: landscape.webp });
    }
    setStage((s) => Math.min(2, s + 1));
  }, [landscape]);
  // An error can fire before React attaches onError (server-rendered <img>).
  const checkLoaded = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth === 0) fail();
    },
    [fail],
  );

  if (!landscape || stage === 2) return <>{fallback}</>;
  const pick = (a: MockupAsset) => (stage === 0 ? a.webp : a.file);
  return (
    <picture key={stage}>
      {portrait && <source media={PORTRAIT_MEDIA} srcSet={pick(portrait)} />}
      <img
        ref={checkLoaded}
        src={pick(landscape)}
        alt=""
        className={className}
        onError={fail}
        decoding="async"
      />
    </picture>
  );
}
