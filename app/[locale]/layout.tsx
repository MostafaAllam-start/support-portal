import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cairo, Geist, Geist_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { ThemeProvider } from "@/components/theme-provider";
import {
  NavigationSkeletonProvider,
  PendingSkeleton,
} from "@/components/navigation-skeleton";
import { Toaster } from "@/components/ui/sonner";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Arabic typeface, applied to the body when the locale is "ar".
const cairo = Cairo({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "ECM+ Support",
  description: "Ticketing and support workspace.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-64.png", type: "image/png", sizes: "64x64" },
      { url: "/icon-128.png", type: "image/png", sizes: "128x128" },
    ],
    apple: { url: "/icon-128.png" },
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables static rendering for this locale.
  setRequestLocale(locale);

  const messages = await getMessages();
  const isArabic = locale === "ar";

  return (
    <html
      lang={locale}
      dir={isArabic ? "rtl" : "ltr"}
      // next-themes sets the theme class on <html> before hydration; suppress the
      // resulting server/client attribute mismatch warning.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} h-full scroll-smooth antialiased`}
    >
      <body
        className="flex min-h-full flex-col"
        // Browser extensions (e.g. ColorZilla's `cz-shortcut-listen`) inject
        // attributes onto <body> before hydration; suppress the resulting
        // server/client attribute mismatch warning.
        suppressHydrationWarning
        style={
          isArabic
            ? {
                fontFamily:
                  "var(--font-arabic), var(--font-geist-sans), sans-serif",
              }
            : undefined
        }
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider locale={locale} messages={messages}>
            {/* The destination's skeleton shows the moment a navigation starts:
                over the whole page for the customer pages, in the content area
                for the dashboard (see its layout). */}
            <NavigationSkeletonProvider>
              <PendingSkeleton area="customer">{children}</PendingSkeleton>
            </NavigationSkeletonProvider>
            <Toaster />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
