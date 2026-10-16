import type { NextResponse } from "next/server";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/load-messages";
import { db } from "../db";

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Saves the chosen language on the account. */
export async function setUserLocale(userId: string, locale: Locale): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { locale } });
}

/** The language saved on the account, or null when none was chosen yet. */
export async function getUserLocale(userId: string): Promise<Locale | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  return isLocale(user?.locale) ? user.locale : null;
}

/** Sets the `NEXT_LOCALE` cookie (1 year). */
export function setLocaleCookie(response: NextResponse, locale: Locale): NextResponse {
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: LOCALE_COOKIE_MAX_AGE,
  });
  return response;
}
