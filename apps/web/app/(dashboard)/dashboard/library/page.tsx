import { LibraryClient } from "@/components/library/library-client";
import {
  getFeaturedPublicBooks,
  getLibraryCategories,
  searchPublicBooks,
} from "@/lib/actions/library";
import { createMetadata } from "@/lib/seo";
import { requireCurrentUser } from "@/lib/auth/server";

export const metadata = createMetadata({
  title: "Library",
  description: "Browse the Glintpage public library from your dashboard.",
  path: "/dashboard/library",
  noIndex: true,
});

export default async function DashboardLibraryPage() {
  await requireCurrentUser();

  const [publicBooks, featuredBooks, categories] = await Promise.all([
    searchPublicBooks(""),
    getFeaturedPublicBooks(),
    getLibraryCategories(),
  ]);

  return (
    <LibraryClient
      mode="public"
      withTopOffset={false}
      initialMyBooks={[]}
      initialPublicBooks={publicBooks}
      initialFeaturedBooks={featuredBooks}
      initialFavorites={[]}
      initialReadingList={[]}
      initialCategories={categories}
      initialTab="discover"
      isAuthenticated
    />
  );
}
