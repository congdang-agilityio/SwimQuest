/**
 * Registry of the art cut from the stakeholder asset sheets (#703, spec: requirement asset sheets A/B).
 *
 * Each art group owns a folder `public/art/mockup/<group>/` with a `manifest.json` (written by
 * `scripts/art/cut_<group>.py`). The registry picks up every group manifest at build time, so a new
 * group lands by adding its folder: no change here. Keys are `<group>/<name>`, e.g.
 * `brand/logo`, `scenes/hero-swimmers-16x9`, `landmarks/landmark-07-ly-son`.
 */
export type MockupAsset = {
  key: string;
  /** Public URL of the PNG (served from `public/`). */
  file: string;
  /** Public URL of the WebP copy. */
  webp: string;
  width: number;
  height: number;
  source: string;
  /** Crop box in the source sheet: [x, y, w, h]. */
  box: number[];
  alt: { vi: string; en: string };
};

function isAsset(value: unknown): value is MockupAsset {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.key === "string" && typeof v.file === "string" && typeof v.width === "number";
}

function loadManifests(): MockupAsset[] {
  try {
    // Resolved by webpack at build time. Outside webpack (unit tests) there is no require.context,
    // and the registry is empty, so callers render their fallbacks.
    const ctx = require.context("../../../public/art/mockup", true, /^\.\/[^/]+\/manifest\.json$/);
    return ctx
      .keys()
      .sort()
      .flatMap((k) => {
        const mod = ctx(k);
        const list = Array.isArray(mod) ? mod : (mod as { default?: unknown }).default;
        return Array.isArray(list) ? list.filter(isAsset) : [];
      });
  } catch {
    return [];
  }
}

export const MOCKUP_ART: readonly MockupAsset[] = loadManifests();

const BY_KEY = new Map<string, MockupAsset>();
for (const a of MOCKUP_ART) {
  if (process.env.NODE_ENV !== "production") {
    if (BY_KEY.has(a.key)) console.warn(`[mockup-art] duplicate key "${a.key}" (${a.file})`);
    if (!/^[^/]+\/[^/]+$/.test(a.key)) {
      console.warn(`[mockup-art] key "${a.key}" is not <group>/<name>`);
    }
  }
  if (!BY_KEY.has(a.key)) BY_KEY.set(a.key, a);
}

export function mockupArt(key: string): MockupAsset | undefined {
  const art = BY_KEY.get(key);
  if (!art && process.env.NODE_ENV !== "production" && MOCKUP_ART.length > 0) {
    console.warn(`[mockup-art] unknown key "${key}"`);
  }
  return art;
}

/** Every asset of one group folder, e.g. `mockupGroup("landmarks")`. */
export function mockupGroup(group: string): MockupAsset[] {
  return MOCKUP_ART.filter((a) => a.key.startsWith(`${group}/`));
}

/** Alt text in the UI locale (vi is the default language). */
export function mockupAlt(asset: MockupAsset, locale: string): string {
  return locale.startsWith("en") ? asset.alt.en : asset.alt.vi;
}
