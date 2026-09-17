import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/lib/locale";

/**
 * next-intl request config — UI_Plan.md §9.
 *
 * Reads the locale cookie on the server so `lang`/`dir` are correct in the very
 * first HTML byte. `cookies()` is async in Next 16 (sync access was removed).
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieValue = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
