import type { Metadata } from "next";
import { Geist, JetBrains_Mono, IBM_Plex_Serif } from "next/font/google";
import "./globals.css";

// Body / UI sans
const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });

// Display serif — clinical-instrument tone, not magazine-italic.
// Medium weight reads as institutional and trustworthy without losing character.
const plexSerif = IBM_Plex_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Data / mono
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
      className={`${geistSans.variable} ${plexSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-canvas text-primary antialiased">{children}</body>
    </html>
  );
}
