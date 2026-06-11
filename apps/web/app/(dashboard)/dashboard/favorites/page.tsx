import { LibraryClient } from "@/components/library/library-client";
import { getUserListBooks } from "@/lib/actions/library";
import { createMetadata } from "@/lib/seo";
import { requireCurrentUser } from "@/lib/auth/server";

export const metadata = createMetadata({
  title: "Favorites",
  description: "Review your favorite books in Glintpage.",
  path: "/dashboard/favorites",
  noIndex: true,
});

export default async function FavoritesPage() {
  await requireCurrentUser();

  const favorites = await getUserListBooks("favorite");

  return (
    <LibraryClient
      mode="favorites"
      initialMyBooks={[]}
      initialPublicBooks={[]}
      initialFeaturedBooks={[]}
      initialFavorites={favorites}
      initialReadingList={[]}
      initialCategories={[]}
      isAuthenticated
    />
  );
}
