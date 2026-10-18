#!/usr/bin/env node
/**
 * Writes docs/assets/manifest.md: the technical asset manifest. One row per image file under
 * public/art/, public/brand/ and public/icons/. Size, format, pixel dimensions and transparency are
 * read from the file itself (PNG and WebP headers, SVG viewBox, no dependencies). The id, source and
 * expected transparency come from the registry (the group manifests in
 * public/art/mockup/<group>/manifest.json that src/lib/art/mockup-art.ts reads, plus the vector
 * fallbacks in src/lib/art/route01-art.ts). A file with no registry entry and a registry entry
 * with no file are listed as warnings, as is a transparency mismatch.
 *
 *   node scripts/art/generate-asset-manifest.mjs          # write the file
 *   node scripts/art/generate-asset-manifest.mjs --check  # exit 1 when the file is out of date
 *                                                         # or when there is any warning
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const PUBLIC = join(ROOT, "public");
const MOCKUP = join(PUBLIC, "art", "mockup");
const OUT = join(ROOT, "docs", "assets", "manifest.md");
const posix = (p) => p.split(sep).join("/");

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** Reads format, size in pixels and alpha from the file. `alpha` is null when it cannot be told. */
function inspect(file) {
  const buf = readFileSync(file);
  const bytes = buf.length;
  if (buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    const colourType = buf[25];
    let hasTrns = false;
    for (let o = 8; o + 8 <= buf.length;) {
      const len = buf.readUInt32BE(o);
      if (buf.toString("latin1", o + 4, o + 8) === "tRNS") hasTrns = true;
      o += 12 + len;
    }
    return {
      format: "PNG",
      bytes,
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
      alpha: colourType === 4 || colourType === 6 || hasTrns,
    };
  }
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    const kind = buf.toString("latin1", 12, 16);
    if (kind === "VP8X") {
      return {
        format: "WebP",
        bytes,
        width: 1 + buf.readUIntLE(24, 3),
        height: 1 + buf.readUIntLE(27, 3),
        alpha: (buf[20] & 0x10) !== 0,
      };
    }
    if (kind === "VP8L") {
      const bits = buf.readUInt32LE(21);
      return {
        format: "WebP",
        bytes,
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
        alpha: ((bits >> 28) & 1) === 1,
      };
    }
    return {
      format: "WebP",
      bytes,
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
      alpha: false,
    };
  }
  const text = buf.toString("utf8", 0, Math.min(buf.length, 4096));
  if (/<svg[\s>]/.test(text)) {
    const vb = text.match(/viewBox="\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)\s*"/);
    const w = text.match(/<svg[^>]*\swidth="([\d.]+)/);
    const h = text.match(/<svg[^>]*\sheight="([\d.]+)/);
    return {
      format: "SVG",
      bytes,
      width: vb ? Number(vb[1]) : w ? Number(w[1]) : 0,
      height: vb ? Number(vb[2]) : h ? Number(h[1]) : 0,
      alpha: true,
    };
  }
  return { format: "unknown", bytes, width: 0, height: 0, alpha: null };
}

// Registry: group manifests (key -> entry) and the route01 vector fallbacks.
const registry = new Map(); // public URL (png) -> { id, source, expectTransparent }
for (const g of readdirSync(MOCKUP).sort()) {
  const m = join(MOCKUP, g, "manifest.json");
  if (!existsSync(m)) continue;
  for (const a of JSON.parse(readFileSync(m, "utf8"))) {
    registry.set(a.file, { id: a.key, source: a.source, group: g, box: a.box });
    registry.set(a.webp, { id: a.key, source: a.source, group: g, box: a.box });
  }
}
const ROUTE01 = readFileSync(join(ROOT, "src", "lib", "art", "route01-art.ts"), "utf8");
for (const m of ROUTE01.matchAll(/LANDMARK_SLUGS = \[([^\]]*)\]/g)) {
  for (const s of m[1].matchAll(/"([a-z_]+)"/g)) {
    registry.set(`/art/route01/landmarks/${s[1]}.svg`, {
      id: `landmark-${s[1]}`,
      source: "vector",
    });
  }
}
for (const t of [1, 2, 3]) {
  registry.set(`/art/ships/ship-tier-${t}.svg`, { id: `ship-tier-${t}`, source: "vector" });
}
registry.set("/art/route01/map.svg", { id: "map", source: "vector" });
for (const f of walk(join(PUBLIC, "art", "emblems"))) {
  const n = posix(relative(PUBLIC, f));
  registry.set(`/${n}`, {
    id: `emblem/${n
      .split("/")
      .pop()
      .replace(/\.svg$/, "")}`,
    source: "vector",
  });
}

// Source text for "usage": src/ files that name the id or the path.
const SOURCES = walk(join(ROOT, "src"))
  .filter((p) => /\.(tsx?|css)$/.test(p) && !/\.test\./.test(p))
  .map((p) => ({ file: posix(relative(ROOT, p)), text: readFileSync(p, "utf8") }));

function area(file) {
  const parts = file.split("/").filter((p) => !/^\(.*\)$/.test(p));
  if (parts[1] === "app") return parts.length > 3 ? parts[2] : "app shell";
  if (parts[1] === "components") return parts[2];
  return parts[parts.length - 1].replace(/\.[a-z]+$/, "");
}

const TEMPLATES = SOURCES.flatMap(({ file, text }) =>
  [...text.matchAll(/\/art\/mockup\/([a-z0-9-]+)\/([a-z0-9-]*)\$\{[^}]*\}([a-z0-9-]*)\./g)].map(
    (m) => ({ file, group: m[1], prefix: m[2], suffix: m[3] }),
  ),
);

function usage(url, id) {
  const stem = url.replace(/\.(png|webp|svg)$/, "");
  const needles = [`"${id}"`, `${stem}.`];
  const base = id.split("/").pop();
  if (/-\d/.test(base)) needles.push(`"${base}"`);
  const files = SOURCES.filter(({ text }) => needles.some((n) => text.includes(n))).map(
    (s) => s.file,
  );
  const m = url.match(/^\/art\/mockup\/([^/]+)\/([^/]+)\.[a-z]+$/);
  if (m) {
    for (const t of TEMPLATES) {
      const mid = m[2].slice(t.prefix.length, m[2].length - t.suffix.length);
      if (
        t.group === m[1] &&
        m[2].startsWith(t.prefix) &&
        m[2].endsWith(t.suffix) &&
        /^[a-z0-9]+$/.test(mid)
      )
        files.push(t.file);
    }
  }
  const areas = [...new Set(files.map(area))].sort();
  return areas.length ? areas.join(", ") : "not used yet";
}

// Pivot: where the object stands on its canvas, as fractions of width and height.
const FOOT_GROUPS = new Set(["characters", "poses", "ships"]);
function pivot(group) {
  return FOOT_GROUPS.has(group) ? "bottom centre (0.5, 1)" : "centre (0.5, 0.5)";
}

const SOURCE_TEXT = {
  "sheet-a": "cut from the concept image (sheet A)",
  "sheet-b": "cut from the concept image (sheet B)",
  "sheet-a-large": "cut from the concept image (sheet A large)",
  "sheet-b-large": "cut from the concept image (sheet B large)",
  vector: "stand-in (hand-drawn vector)",
  "stakeholder-2026-10-18": "delivered by the stakeholder (2026-10-18)",
};

const files = ["art", "brand", "icons"]
  .flatMap((d) => walk(join(PUBLIC, d)))
  .filter((p) => /\.(png|webp|svg)$/.test(p));
const rows = [];
const warnings = [];
const seenUrls = new Set();
for (const f of files) {
  const url = `/${posix(relative(PUBLIC, f))}`;
  seenUrls.add(url);
  const info = inspect(f);
  const reg = registry.get(url);
  const parts = url.split("/");
  const inMockup = url.startsWith("/art/mockup/");
  const group = inMockup ? parts[3] : (parts[2] ?? "");
  let id = reg?.id;
  let licence;
  if (reg) licence = SOURCE_TEXT[reg.source] ?? reg.source;
  else if (inMockup && group.startsWith("screen-")) {
    id = `${group}/${parts[4].replace(/\.[a-z]+$/, "")}`;
    licence = "cut from the concept image (temporary screen crop)";
  } else if (url.startsWith("/icons/") || url.startsWith("/art/mockup/brand/")) {
    id = `icons/${parts[2].replace(/\.[a-z]+$/, "")}`;
    licence = "made otherwise (PWA icon made from the app icon)";
  }
  if (!id) {
    id = "(none)";
    licence = "unknown";
    warnings.push(`\`${url}\` has no registry entry`);
  }
  // Backgrounds, rectangular screen crops, the route map art and the PWA icons are opaque on purpose.
  const opaque =
    group === "scenes" ||
    (group === "map" && /^route\d+-/.test(parts[4] ?? "")) ||
    url.startsWith("/icons/") ||
    (group.startsWith("screen-") && /hero|thumb|map/.test(parts[4] ?? ""));
  if (info.alpha !== null && url !== "/art/route01/map.svg" && info.alpha === opaque) {
    warnings.push(
      `\`${url}\`: the registry expects ${opaque ? "an opaque" : "a transparent"} image, the file is ${
        info.alpha ? "transparent" : "opaque"
      }`,
    );
  }
  rows.push({
    id,
    url,
    group: inMockup ? group : parts[1] === "icons" ? "icons" : `${parts[1]}/${parts[2] ?? ""}`,
    info,
    pivot: pivot(group),
    licence,
    usage: usage(url, id),
  });
}
for (const url of registry.keys()) {
  if (!seenUrls.has(url))
    warnings.push(`registry entry \`${registry.get(url).id}\` has no file \`public${url}\``);
}

const cell = (s) => String(s).replace(/\|/g, "\\|");
const lines = [
  "# SwimQuest technical asset manifest",
  "",
  "<!-- Generated by `node scripts/art/generate-asset-manifest.mjs`. Do not edit by hand. -->",
  "",
  "One row per image file under `public/art/`, `public/brand/` and `public/icons/`. Size, format,",
  "pixel size and transparency are read from the file (PNG and WebP headers, SVG `viewBox`). The id",
  "and source come from the registry (`src/lib/art/mockup-art.ts` and the group manifests).",
  "Pivot is the anchor on the canvas, as a fraction of width and height. Frames is 1 for every",
  "asset: there are no sprite sheets. For the plain-English list of what each asset shows and how to",
  "replace it, see [replacement-list.md](replacement-list.md).",
  "",
  "Regenerate with `node scripts/art/generate-asset-manifest.mjs`.",
  "",
  `Files: ${rows.length}. Total bytes: ${rows.reduce((s, r) => s + r.info.bytes, 0)}. Warnings: ${warnings.length}.`,
  "",
  "## Warnings",
  "",
  ...(warnings.length ? warnings.map((w) => `- ${w}`) : ["None."]),
];
const byGroup = new Map();
for (const r of rows) (byGroup.get(r.group) ?? byGroup.set(r.group, []).get(r.group)).push(r);
for (const [g, list] of byGroup) {
  lines.push(
    "",
    `## ${g}`,
    "",
    "| Id | Path | Bytes | Format | Size | Transparency | Frames | Pivot | Source / licence | Usage |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...list.map(
      (r) =>
        `| \`${cell(r.id)}\` | \`public${r.url}\` | ${r.info.bytes} | ${r.info.format} | ${r.info.width}x${r.info.height} | ${
          r.info.alpha === null ? "unknown" : r.info.alpha ? "yes" : "no"
        } | 1 | ${r.pivot} | ${cell(r.licence)} | ${cell(r.usage)} |`,
    ),
  );
}
const text = lines.join("\n") + "\n";

if (process.argv.includes("--check")) {
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (current !== text) {
    console.error("docs/assets/manifest.md is out of date: run the script.");
    process.exit(1);
  }
  if (warnings.length) {
    console.error(`The manifest has ${warnings.length} warning(s):\n${warnings.join("\n")}`);
    process.exit(1);
  }
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  console.log(
    `wrote ${posix(relative(ROOT, OUT))} (${rows.length} files, ${warnings.length} warnings)`,
  );
}
