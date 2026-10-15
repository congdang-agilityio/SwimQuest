import registry from "./assets.json";

export type AssetSource = "concept-cut" | "stand-in" | "replaced";

export type AssetSpec = {
  width: number;
  height: number;
  format: "svg" | "png" | "webp" | "json";
  transparent: boolean;
  frames: number;
};

export type AssetEntry = {
  id: string;
  /** Public URL path, served from `public/`. */
  path: string;
  /** What the asset shows, in plain English. */
  shows: string;
  /** Screens that use it. */
  usedIn: string[];
  source: AssetSource;
  /** What a replacement file must provide. */
  spec: AssetSpec;
  /** What is wrong with the current version, in plain English. */
  issues: string;
};

export const ASSETS = registry as AssetEntry[];

export function getAsset(id: string): AssetEntry | undefined {
  return ASSETS.find((a) => a.id === id);
}
