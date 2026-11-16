import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CALENDAR. · Architecture for Time.",
    template: "%s · CALENDAR.",
  },
  description:
    "CALENDAR. is Eiden Group's internal scheduling system: meeting rooms, formations and clients, engineered for clarity. Architecture for Time.",
  metadataBase: new URL("https://calendar.eiden-group.com"),
  applicationName: "CALENDAR.",
  appleWebApp: { capable: true, title: "CALENDAR.", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#F5F5F7",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Entire app is per-user/per-request: block prerender so cookie-based
  // locale reads are legal everywhere (Cache Components mode).
  await connection();
  const locale = await getLocale();
  return (
    <html lang={locale} className="h-full">
      <body className="min-h-full bg-canvas font-sans text-obsidian antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
