import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Fortify — HIPAA compliance that runs itself",
  description:
    "Continuous HIPAA, SOC 2, ISO 27001, and GDPR compliance for healthcare practices. AI-powered evidence collection, automated audit readiness, and 24/7 drift monitoring.",
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
