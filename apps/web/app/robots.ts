import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/about",
          "/changelog",
          "/contact",
          "/privacy",
          "/refund-policy",
          "/terms",
        ],
        disallow: [
          "/api/",
          "/auth/",
          "/billing",
          "/dashboard",
          "/profile",
          "/read/",
          "/library",
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
