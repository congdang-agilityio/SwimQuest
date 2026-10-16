import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { apiError } from "@/server/http/api-error";
import { isSameOrigin, readJson } from "@/server/http/request";
import { isLocale, setLocaleCookie, setUserLocale } from "@/server/profile/locale";

export const dynamic = "force-dynamic";

/**
 * PUT /api/locale `{ locale: "vi" | "en" }`: sets the `NEXT_LOCALE` cookie and, when signed in,
 * saves the language on the account.
 */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return apiError(403, "FORBIDDEN_ORIGIN");
  const json = await readJson(request);
  if (!json.ok) return apiError(400, "INVALID_BODY");
  const locale = (json.body as { locale?: unknown } | null)?.locale;
  if (!isLocale(locale)) return apiError(400, "VALIDATION_FAILED", { locale: "INVALID_LOCALE" });

  const user = await getCurrentUser();
  if (user) await setUserLocale(user.id, locale);
  return setLocaleCookie(
    NextResponse.json({ locale }, { headers: { "cache-control": "no-store" } }),
    locale,
  );
}
