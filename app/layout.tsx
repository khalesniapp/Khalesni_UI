import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import localFont from "next/font/local";

import { NavShell } from "@/components/shell/NavShell";
import { dirFor, type Locale } from "@/lib/locale";
import { DEFAULT_THEME, isTheme, themeAttribute, THEME_COOKIE } from "@/lib/theme";
import { Providers } from "./providers";
import "./globals.css";

/**
 * Fonts — UI_Plan.md §8.3.
 *
 * The faces are vendored in app/fonts/ and loaded with `next/font/local`
 * rather than `next/font/google`, which downloads from fonts.gstatic.com at
 * build time: that fetch is flaky here and would make CI fail for reasons
 * unrelated to the code. Self-hosting keeps the same behaviour (swap, no
 * render-blocking request, no third-party connection) with no network
 * dependency at all. To update a face, re-run the fetch script in the repo
 * notes rather than editing these files by hand.
 *
 * Open Sans and both Noto families ship as variable fonts, so one file covers
 * the whole weight range. Poppins is three statics.
 *
 * Only the body regular weight is preloaded (`font-preload`); the heading and
 * Arabic faces load on demand, which keeps the LCP request chain short.
 */
const poppins = localFont({
  variable: "--font-poppins",
  display: "swap",
  preload: false,
  src: [
    { path: "./fonts/poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-700.woff2", weight: "700", style: "normal" },
  ],
});

const openSans = localFont({
  variable: "--font-open-sans",
  display: "swap",
  preload: true,
  src: [{ path: "./fonts/open-sans-variable.woff2", weight: "400 700", style: "normal" }],
});

const notoKufiArabic = localFont({
  variable: "--font-noto-kufi-arabic",
  display: "swap",
  preload: false,
  src: [
    { path: "./fonts/noto-kufi-arabic-variable.woff2", weight: "500 700", style: "normal" },
  ],
});

const notoSansArabic = localFont({
  variable: "--font-noto-sans-arabic",
  display: "swap",
  preload: false,
  src: [
    { path: "./fonts/noto-sans-arabic-variable.woff2", weight: "400 700", style: "normal" },
  ],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: t("name"),
    description: t("tagline"),
  };
}

export const viewport: Viewport = {
  // §13: pinch-zoom must not be blocked, and text must survive 200 % zoom.
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // §9: locale and direction are resolved on the server so the first byte of
  // HTML is already correct — there is no LTR flash on an Arabic load.
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const dir = dirFor(locale);

  // Same reasoning for the theme: reading the cookie here means no white
  // flash before hydration. "system" writes no attribute, leaving the
  // prefers-color-scheme block in globals.css in charge.
  const themeCookie = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = isTheme(themeCookie) ? themeCookie : DEFAULT_THEME;

  const t = await getTranslations("common");

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={themeAttribute(theme)}
      className={`${poppins.variable} ${openSans.variable} ${notoKufiArabic.variable} ${notoSansArabic.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:text-primary"
        >
          {t("skipToContent")}
        </a>

        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <NavShell>{children}</NavShell>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
