import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CALENDAR. — Architecture for Time.",
    template: "%s · CALENDAR.",
  },
  description:
    "CALENDAR. is Eiden Group's internal scheduling system — meeting rooms, formations and clients, engineered for clarity. Architecture for Time.",
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-canvas font-sans text-obsidian antialiased">
        {children}
      </body>
    </html>
  );
}
