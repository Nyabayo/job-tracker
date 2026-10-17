import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";
import { connection } from "next/server";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { CsrfProvider } from "@/components/security/csrf";
import { csrfToken } from "@/lib/security/csrf";
import { currentTheme } from "@/lib/theme";
import "./globals.css";

// Fonts are downloaded at build time and served from this app, so no request
// ever goes to Google from a user's browser.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});
const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Job Tracker", template: "%s · Job Tracker" },
  description: "Track every job application on one simple board. Free and open source.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F6F2" },
    { media: "(prefers-color-scheme: dark)", color: "#12131B" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Every page renders per request so its scripts carry that request's CSP
  // nonce (set in proxy.ts).
  await connection();
  const theme = await currentTheme();
  return (
    <html lang="en" data-theme={theme} className={`${bricolage.variable} ${publicSans.variable}`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[10px] focus:bg-surface focus:px-4 focus:py-3 focus:text-text"
        >
          Skip to content
        </a>
        <OfflineBanner />
        <CsrfProvider token={await csrfToken()}>{children}</CsrfProvider>
      </body>
    </html>
  );
}
