import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Tenant app, APIs, auth plumbing, and tokenized invite pages are
        // never crawlable surface.
        disallow: ["/app/", "/api/", "/auth/", "/join/", "/screening/"],
      },
    ],
    sitemap: "https://fortifynow.xyz/sitemap.xml",
  };
}
