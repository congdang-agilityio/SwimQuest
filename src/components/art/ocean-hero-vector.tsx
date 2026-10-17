import { shipArt } from "@/lib/art/route01-art";
import styles from "./ocean-hero.module.css";

/**
 * Fallback when the cut art is not in the registry. Decorative hero from the mockup's welcome screen: sky, islands, the Lý Sơn lighthouse and the
 * sea, drawn as vector art (no raster, no text in the art) with the tier-2 ship from public/art.
 */
export function OceanHeroVector({ className }: { className?: string }) {
  const ship = shipArt(2);
  return (
    <div className={[styles.hero, className].filter(Boolean).join(" ")} aria-hidden="true">
      <svg
        className={styles.scene}
        viewBox="0 0 400 260"
        preserveAspectRatio="xMidYMax slice"
        focusable="false"
      >
        <defs>
          <linearGradient id="oh-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4fb3ec" />
            <stop offset="0.65" stopColor="#bfe7fb" />
            <stop offset="1" stopColor="#f4fbff" />
          </linearGradient>
          <linearGradient id="oh-sea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#20c8c2" />
            <stop offset="0.35" stopColor="#00aeef" />
            <stop offset="1" stopColor="#003b66" />
          </linearGradient>
          <linearGradient id="oh-hill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#6dbe6a" />
            <stop offset="1" stopColor="#2f7f48" />
          </linearGradient>
          <radialGradient id="oh-sun" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff6d8" />
            <stop offset="1" stopColor="#fff6d8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="260" fill="url(#oh-sky)" />
        <circle cx="70" cy="40" r="60" fill="url(#oh-sun)" />
        {/* clouds */}
        <g fill="#ffffff" opacity="0.92">
          <ellipse cx="120" cy="52" rx="34" ry="11" />
          <ellipse cx="140" cy="44" rx="20" ry="12" />
          <ellipse cx="300" cy="34" rx="30" ry="9" />
          <ellipse cx="318" cy="27" rx="16" ry="10" />
          <ellipse cx="226" cy="70" rx="22" ry="6" opacity="0.7" />
        </g>
        {/* distant mountains */}
        <path
          d="M0 150 L40 112 L78 132 L120 96 L170 140 L200 150 Z"
          fill="#3f8fb5"
          opacity="0.55"
        />
        <path d="M150 152 L200 124 L236 146 L262 150 Z" fill="#3f8fb5" opacity="0.45" />
        {/* left headland with beach */}
        <path d="M0 132 Q30 112 62 128 Q92 140 120 160 L0 168 Z" fill="url(#oh-hill)" />
        <path d="M0 162 Q60 150 130 166 L0 176 Z" fill="#f5e6c8" />
        {/* lighthouse island */}
        <path
          d="M230 168 Q240 128 278 118 Q300 98 326 112 Q362 120 384 168 Z"
          fill="url(#oh-hill)"
        />
        <path d="M222 170 Q250 156 300 160 Q350 156 392 172 Z" fill="#a98f6a" />
        {/* lighthouse */}
        <g stroke="#062b46" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M296 112 L300 54 L316 54 L320 112 Z" fill="#f4fbff" />
          <path d="M297.6 92 L318.4 92 L319.1 100 L296.9 100 Z" fill="#ff6b6b" />
          <path d="M299 72 L317 72 L317.6 80 L298.4 80 Z" fill="#ff6b6b" />
          <rect x="296" y="46" width="24" height="8" fill="#ffd166" />
          <path d="M294 46 L308 32 L322 46 Z" fill="#ff6b6b" />
          <rect x="292" y="52" width="32" height="3" fill="#062b46" />
        </g>
        <path d="M320 50 L400 34 L400 62 Z" fill="#fff6d8" opacity="0.35" />
        {/* sea */}
        <path d="M0 166 Q100 158 200 166 T400 166 V260 H0 Z" fill="url(#oh-sea)" />
        <g fill="none" stroke="#f4fbff" strokeWidth="2" strokeLinecap="round" opacity="0.55">
          <path d="M30 196 q12 -6 24 0 t24 0" />
          <path d="M250 188 q12 -6 24 0 t24 0" />
          <path d="M150 222 q12 -6 24 0 t24 0" />
          <path d="M310 232 q12 -6 24 0 t24 0" />
        </g>
      </svg>
      {ship && (
        // eslint-disable-next-line @next/next/no-img-element -- static vector art
        <img className={styles.ship} src={ship.path} alt="" width={128} height={96} />
      )}
    </div>
  );
}
