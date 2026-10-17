import { existsSync } from "node:fs";
import { join } from "node:path";
import { MOCKUP_ART, type MockupAsset } from "@/lib/art/mockup-art";

export type AssetStatus = MockupAsset & {
  /** Folder name, e.g. `badges`. */
  group: string;
  /** Whether the PNG is in `public/`. A missing file renders through the ArtImage fallback. */
  exists: boolean;
};

/** Groups whose art is shown small in the UI (also previewed at 24, 32 and 48 px). */
export const ICON_GROUPS: readonly string[] = ["badges", "medals", "items", "map", "marine"];

/** Server only: every registry entry with whether its file is present under `public/`. */
export function listAssetStatus(): AssetStatus[] {
  return MOCKUP_ART.map((a) => ({
    ...a,
    group: a.key.split("/")[0],
    exists: existsSync(join(process.cwd(), "public", a.file)),
  }));
}
