import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

const publicRoutes = [
  { path: "/", priority: 1 },
  { path: "/about", priority: 0.75 },
  { path: "/changelog", priority: 0.6 },
  { path: "/contact", priority: 0.55 },
  { path: "/privacy", priority: 0.35 },
  { path: "/refund-policy", priority: 0.35 },
  { path: "/terms", priority: 0.35 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return publicRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.path === "/" ? "weekly" : "monthly",
    priority: route.priority,
  }));
}
