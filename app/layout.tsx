import type { Metadata } from "next";
// next/font/google fetches font files at build time and inlines them into
// the output bundle. Vercel + GitHub Actions both have reliable egress to
// fonts.googleapis.com so this works today. If we ever change build envs
// without that egress, swap to local TTF files under public/fonts and
// use next/font/local instead — no other call site changes required.
import { Geist, JetBrains_Mono, IBM_Plex_Serif, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });

const plexSerif = IBM_Plex_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Marketing display — variable serif with personality.
// Used on the public landing pages only.
const fraunces = Fraunces({
  variable: "--font-marketing",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const SITE_DESCRIPTION =
  "Continuous HIPAA, SOC 2, ISO 27001, and GDPR compliance for healthcare practices. AI-powered evidence collection, automated audit readiness, and 24/7 drift monitoring.";

export const metadata: Metadata = {
  metadataBase: new URL("https://fortifynow.xyz"),
  title: {
    default: "Fortify — HIPAA compliance that runs itself",
    template: "%s · Fortify",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Fortify",
    url: "https://fortifynow.xyz",
    title: "Fortify — HIPAA compliance that runs itself",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: "Fortify — HIPAA compliance that runs itself",
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${plexSerif.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-canvas text-primary antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
