// Fails when any message file encourages unsafe distance, pace, night swimming or solo
// open-water swimming. Run by `npm run check:safety-copy` (part of `npm run lint`).
// The `safety` namespace may name the risks it warns about. Review checklist:
// docs/safety-copy-checklist.md.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findUnsafePhrases } from "../src/lib/safety/unsafe-phrases.ts";

const ALLOWED_NAMESPACES = new Set(["safety"]);
const LOCALES = ["vi", "en"];

function* strings(value, path) {
  if (typeof value === "string") yield [path, value];
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) yield* strings(v, path ? `${path}.${k}` : k);
  }
}

let failures = 0;
for (const locale of LOCALES) {
  const dir = join("messages", locale);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    if (ALLOWED_NAMESPACES.has(file.replace(/\.json$/, ""))) continue;
    const json = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const [key, text] of strings(json, "")) {
      for (const hit of findUnsafePhrases(text)) {
        failures++;
        console.error(`${dir}/${file} ${key}: "${hit.text}" (${hit.id})`);
      }
    }
  }
}
if (failures) {
  console.error(`\n${failures} unsafe phrase(s) in app copy. See docs/safety-copy-checklist.md.`);
  process.exit(1);
}
console.log("Safety copy check passed.");
