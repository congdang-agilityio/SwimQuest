import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const TIME_ZONE = "Asia/Ho_Chi_Minh";

export type Messages = Record<string, Record<string, unknown>>;

const MESSAGES_DIR = path.join(process.cwd(), "messages");
const cache = new Map<string, Messages>();

export function resolveLocale(value: string | undefined | null): Locale {
  return (LOCALES as readonly string[]).includes(value ?? "") ? (value as Locale) : DEFAULT_LOCALE;
}

/** Merge every `<dir>/<locale>/*.json` into one object keyed by file name (namespace). */
export async function loadMessages(locale: string, dir: string = MESSAGES_DIR): Promise<Messages> {
  const resolved = resolveLocale(locale);
  const key = `${dir}\0${resolved}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const localeDir = path.join(dir, resolved);
  const files = (await readdir(localeDir)).filter((f) => f.endsWith(".json")).sort();
  const messages: Messages = {};
  for (const file of files) {
    messages[path.basename(file, ".json")] = JSON.parse(
      await readFile(path.join(localeDir, file), "utf8"),
    );
  }
  if (process.env.NODE_ENV === "production") cache.set(key, messages);
  return messages;
}
