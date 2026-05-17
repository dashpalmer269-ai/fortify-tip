import type { Metadata } from "next";
import { Geist, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Body/UI sans — clean, technical
const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });

// Display serif — editorial, distinctive, characterful
// Used only at hero / page-title scale to set the high-end tone
const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

// Data / mono — for numbers, code, citations, tabular figures
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
      className={`${geistSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-canvas text-primary antialiased">{children}</body>
    </html>
  );
}
