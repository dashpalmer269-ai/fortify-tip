import type { MetadataRoute } from "next";

/** Marketing surface only — the app is auth-gated and excluded via robots. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://fortifynow.xyz";
  const pages: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1 },
    { path: "/pricing", priority: 0.9 },
    { path: "/architecture", priority: 0.7 },
    { path: "/signup", priority: 0.8 },
    { path: "/login", priority: 0.3 },
    { path: "/status", priority: 0.2 },
  ];
  return pages.map((p) => ({
    url: `${base}${p.path}`,
    changeFrequency: "weekly",
    priority: p.priority,
  }));
}
