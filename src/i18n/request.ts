import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, TIME_ZONE, loadMessages, resolveLocale } from "./load-messages";

export default getRequestConfig(async () => {
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { locale, messages: await loadMessages(locale), timeZone: TIME_ZONE };
});
