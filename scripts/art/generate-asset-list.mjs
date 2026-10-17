#!/usr/bin/env node
/**
 * Writes docs/assets/replacement-list.md: the plain-English list of every art asset, generated
 * from the group manifests in public/art/mockup/<group>/manifest.json (the same data the art
 * registry, src/lib/art/mockup-art.ts, reads) plus the temporary screen crops and the older
 * vector fallbacks. "Used in" is found by searching src/ for each asset's key or path.
 *
 *   node scripts/art/generate-asset-list.mjs          # write the file
 *   node scripts/art/generate-asset-list.mjs --check  # exit 1 when the file is out of date
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const ART = join(ROOT, "public", "art");
const MOCKUP = join(ART, "mockup");
const OUT = join(ROOT, "docs", "assets", "replacement-list.md");

const GROUP_INFO = {
  brand: ["G1 #703", "Logo and app icon", "logo: natural aspect, 1024 px wide; icon: 512x512"],
  scenes: [
    "G1 #703",
    "Backgrounds and hero scenes",
    "rectangle at 16:9, 4:3 and 9:16 where the scene allows",
  ],
  landmarks: ["G1 #703", "Route 01 landmark islands", "384x288, no wooden sign or label"],
  characters: ["G2 #704", "Characters", "256x384"],
  poses: ["G2 #704", "Swimmer poses", "384x256 (swimming), 256x384 (standing)"],
  ships: ["G2 #704", "Team ships", "384x384, bow facing right"],
  badges: ["G2 #704", "Badges", "256x256, no caption"],
  medals: ["G2 #704", "Ranking medals and trophies", "256x256"],
  marine: ["G3 #706", "Sea creatures", "256x256"],
  items: ["G3 #706", "Items, power-ups and collectibles", "256x256"],
  map: ["G3 #706", "Route map elements", "256x256"],
  effects: ["G3 #706", "Effects", "256x256, glow kept"],
  decor: ["G3 #706", "Decoration", "256x256"],
};

const SOURCE_TEXT = {
  "sheet-a": "asset sheet A",
  "sheet-b": "asset sheet B",
  "sheet-a-large": "asset sheet A (large)",
  "sheet-b-large": "asset sheet B (large)",
};

function walk(dir, filter, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

const posix = (p) => p.split(sep).join("/");

// Source files to search for uses (tests do not count as uses).
const SOURCES = walk(join(ROOT, "src"), (p) => /\.(tsx?|css)$/.test(p) && !/\.test\./.test(p)).map(
  (p) => ({ file: posix(relative(ROOT, p)), text: readFileSync(p, "utf8") }),
);

// Template paths such as `/art/mockup/ships/ship-tier-${tier}.png` use the files that fill the
// placeholder with one word (ship-tier-1, not ship-tier-1-small).
const TEMPLATES = SOURCES.flatMap(({ file, text }) =>
  [...text.matchAll(/\/art\/mockup\/([a-z0-9-]+)\/([a-z0-9-]*)\$\{[^}]*\}([a-z0-9-]*)\./g)].map(
    (m) => ({ file, group: m[1], prefix: m[2], suffix: m[3] }),
  ),
);

function templateUses(group, name) {
  return TEMPLATES.filter(
    (t) =>
      t.group === group &&
      name.startsWith(t.prefix) &&
      name.endsWith(t.suffix) &&
      /^[a-z0-9]+$/.test(name.slice(t.prefix.length, name.length - t.suffix.length)),
  ).map((t) => t.file);
}

/** Screen or area of a source file: src/app/(app)/voyage/... -> voyage. */
function area(file) {
  const parts = file.split("/").filter((p) => !/^\(.*\)$/.test(p));
  if (parts[1] === "app") return parts.length > 3 ? parts[2] : "app shell";
  if (parts[1] === "components") return parts[2];
  // Shared code (src/lib, src/server): name the module, e.g. `route01-art`.
  return parts[parts.length - 1].replace(/\.[a-z]+$/, "");
}

function usedIn(key) {
  const name = key.split("/")[1];
  const needles = [`"${key}"`, `/art/mockup/${key}.`];
  // Quoted bare names only when they are specific enough (e.g. "landmark-01-non-nuoc").
  if (/-\d/.test(name)) needles.push(`"${name}"`);
  const files = SOURCES.filter(({ text }) => needles.some((n) => text.includes(n))).map(
    (s) => s.file,
  );
  files.push(...templateUses(key.split("/")[0], name));
  const areas = [...new Set(files.map(area))].sort();
  return areas.length ? areas.join(", ") : "not used yet";
}

const cell = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");

function groupTable(group, assets) {
  const rows = assets.map((a) => {
    const name = a.key.split("/")[1];
    return `| \`${name}\` | ${cell(a.alt.en)} (${cell(a.alt.vi)}) | ${usedIn(a.key)} | ${
      SOURCE_TEXT[a.source] ?? a.source
    } | ${a.width}x${a.height} | \`public${a.file}\` | cut from the sheets |`;
  });
  return [
    "| Name | What it shows | Used in | Source | Size | File (PNG; WebP next to it) | Status |",
    "|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

const groups = readdirSync(MOCKUP)
  .filter((g) => existsSync(join(MOCKUP, g, "manifest.json")))
  .sort((a, b) => {
    const order = Object.keys(GROUP_INFO);
    return (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b);
  });

const lines = [
  "# SwimQuest art asset list",
  "",
  "<!-- Generated by `node scripts/art/generate-asset-list.mjs`. Do not edit by hand. -->",
  "",
  "Every image the app uses, where it comes from and what a replacement must match. The art is cut",
  "from the stakeholder's asset sheets A and B (`requirement/assets/reference/`) by the scripts in",
  "`scripts/art/`, one object per file, no text in the image, transparent background, fixed canvas",
  "per group. The app reads it through the registry in `src/lib/art/mockup-art.ts` by key",
  '(`<group>/<name>`, e.g. `marine/dolphin`). "Used in" names the screens or areas whose code uses',
  "the asset.",
  "",
  "## How to replace an asset",
  "",
  "1. Deliver a PNG with a transparent background (backgrounds: opaque), no text, on the same canvas",
  "   size as the row below, object centred with about 8% padding.",
  "2. Save it at the same path, and a WebP copy (quality 90) next to it with the same name.",
  "   Or change the crop box in `scripts/art/cut_<group>.py` and re-run the script.",
  "3. If the source changed, update the entry's `source` and `box` in the group's `manifest.json`.",
  "4. Run `node scripts/art/generate-asset-list.mjs` to refresh this list.",
  "",
  "The app picks the new file up with no code change, because it uses keys, not file names.",
  "",
  "## Summary",
  "",
  "| Group | Owner | What | Count | Canvas |",
  "|---|---|---|---|---|",
];

const manifests = {};
for (const g of groups) {
  manifests[g] = JSON.parse(readFileSync(join(MOCKUP, g, "manifest.json"), "utf8"));
  const [owner, what, canvas] = GROUP_INFO[g] ?? ["", g, ""];
  lines.push(`| [${g}](#${g}) | ${owner} | ${what} | ${manifests[g].length} | ${canvas} |`);
}

for (const g of groups) {
  const [owner, what, canvas] = GROUP_INFO[g] ?? ["", g, ""];
  lines.push(
    "",
    `## ${g}`,
    "",
    `${what}. Owner: ${owner || "n/a"}. Canvas: ${canvas || "n/a"}.`,
    "",
  );
  lines.push(groupTable(g, manifests[g]));
}

// Screen-local crops from the UI mockup, waiting for a group asset to replace them.
const screenFiles = readdirSync(MOCKUP)
  .filter((g) => g.startsWith("screen-"))
  .sort()
  .flatMap((g) =>
    walk(join(MOCKUP, g), (p) => /\.(png|webp)$/.test(p)).filter(
      (p) => !(p.endsWith(".webp") && existsSync(p.replace(/\.webp$/, ".png"))),
    ),
  );
lines.push(
  "",
  "## Temporary screen crops",
  "",
  "Cut straight from the UI mockup for one screen, before the group assets existed. Replace each",
  "with a group asset (or a new cut from the sheets) and point the code at the registry key.",
  "",
  "| File | Used in | Status |",
  "|---|---|---|",
  ...screenFiles.map((p) => {
    const url = posix(relative(join(ROOT, "public"), p));
    const name = url.replace(/^art\/mockup\//, "").replace(/\.(png|webp)$/, "");
    const files = SOURCES.filter(
      ({ text }) => text.includes(`/${url}`) || text.includes(`/art/mockup/${name}`),
    ).map((s) => s.file);
    const [group, base] = name.split("/");
    files.push(...templateUses(group, base));
    const areas = [...new Set(files.map(area))].sort().join(", ") || "not used yet";
    return `| \`public/${url}\` | ${areas} | temporary mockup crop |`;
  }),
);

// Earlier vector stand-ins, kept only as load fallbacks.
const vectors = walk(ART, (p) => p.endsWith(".svg") && !p.startsWith(MOCKUP)).map((p) =>
  posix(relative(join(ROOT, "public"), p)),
);
lines.push(
  "",
  "## Vector fallbacks",
  "",
  "Simple vectors drawn before the sheets arrived. The app shows them only if the sheet art fails",
  "to load; they need no replacement.",
  "",
  ...vectors.map((v) => `- \`public/${v}\``),
  "",
);

// Formatted with the repo's Prettier settings, so CI's format check and --check agree.
const prettier = await import("prettier");
const options = (await prettier.resolveConfig(OUT)) ?? {};
const text = await prettier.format(lines.join("\n"), { ...options, parser: "markdown" });
if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== text) {
    console.error("docs/assets/replacement-list.md is out of date: run the script.");
    process.exit(1);
  }
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  console.log(`wrote ${posix(relative(ROOT, OUT))}`);
}
