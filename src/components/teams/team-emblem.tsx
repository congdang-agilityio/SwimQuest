"use client";

import { useState } from "react";
import { emblemPath, isEmblemKey } from "@/lib/emblems";

type TeamEmblemProps = {
  emblemKey: string | null | undefined;
  size: number;
  /** Accessible text, supplied by the caller from messages. */
  alt: string;
};

export function TeamEmblem({ emblemKey, size, alt }: TeamEmblemProps) {
  const [failed, setFailed] = useState(false);

  if (!isEmblemKey(emblemKey) || failed) {
    return (
      <svg
        role="img"
        aria-label={alt}
        width={size}
        height={size}
        viewBox="0 0 64 64"
        data-testid="team-emblem-fallback"
      >
        <circle cx="32" cy="32" r="30" fill="#F4FBFF" stroke="#003B66" strokeWidth="4" />
        <path d="M16 36q8-8 16 0t16 0" fill="none" stroke="#00AEEF" strokeWidth="4" />
      </svg>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, no optimisation needed
    <img
      src={emblemPath(emblemKey)}
      alt={alt}
      width={size}
      height={size}
      onError={() => setFailed(true)}
    />
  );
}
