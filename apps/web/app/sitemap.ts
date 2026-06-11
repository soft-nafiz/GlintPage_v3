import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { absoluteUrl } from "@/lib/seo";

const publicRoutes = [
  { path: "/", priority: 1 },
  { path: "/library", priority: 0.85 },
  { path: "/about", priority: 0.75 },
  { path: "/changelog", priority: 0.6 },
  { path: "/contact", priority: 0.55 },
  { path: "/privacy", priority: 0.35 },
  { path: "/refund-policy", priority: 0.35 },
  { path: "/terms", priority: 0.35 },
] as const;

type PublicBookSitemapRow = {
  id: string;
  created_at: string | null;
};

type CategorySitemapRow = {
  slug: string;
};

export const revalidate = 86400;

async function getPublicBookRoutes(): Promise<MetadataRoute.Sitemap> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) return [];

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  const [{ data: books, error: booksError }, { data: categories, error: categoriesError }] =
    await Promise.all([
      supabase
        .from("books")
        .select("id, created_at")
        .eq("is_public", true)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("library_categories")
        .select("slug")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

  if (booksError) {
    console.error("[sitemap:books]", booksError.message);
  }

  if (categoriesError) {
    console.error("[sitemap:categories]", categoriesError.message);
  }

  const bookRoutes = ((books || []) as PublicBookSitemapRow[]).map((book) => ({
    url: absoluteUrl(`/books/${book.id}`),
    lastModified: book.created_at ? new Date(book.created_at) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.55,
  }));

  const categoryRoutes = ((categories || []) as CategorySitemapRow[]).map((category) => ({
    url: absoluteUrl(`/library/category/${category.slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.65,
  }));

  return [...categoryRoutes, ...bookRoutes];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = publicRoutes.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.path === "/" ? "weekly" : "monthly" as const,
    priority: route.priority,
  }));

  try {
    return [...staticRoutes, ...(await getPublicBookRoutes())];
  } catch (error) {
    console.error("[sitemap]", error);
    return staticRoutes;
  }
}
