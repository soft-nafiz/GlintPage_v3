import { createClient } from "@/lib/supabase/server";
import {
  getFeaturedPublicBooks,
  getLibraryCategories,
  getMyBooks,
  getUserListBooks,
  searchPublicBooks,
} from "@/lib/actions/library";
import { LibraryClient } from "@/components/library/library-client";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Library",
  description:
    "Explore public-domain books on Glintpage, search by title, author, and genre, and continue reading your saved books.",
  path: "/library",
  keywords: ["online book library", "public domain books", "AI reader library"],
});

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ processing?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [myBooks, publicBooks, featuredBooks, favorites, readingList, categories] = await Promise.all([
    user ? getMyBooks() : Promise.resolve([]),
    searchPublicBooks(""),
    getFeaturedPublicBooks(),
    user ? getUserListBooks("favorite") : Promise.resolve([]),
    user ? getUserListBooks("reading_list") : Promise.resolve([]),
    getLibraryCategories(),
  ]);

  const params = await searchParams;

  return (
    <LibraryClient
      initialMyBooks={myBooks}
      initialPublicBooks={publicBooks}
      initialFeaturedBooks={featuredBooks}
      initialFavorites={favorites}
      initialReadingList={readingList}
      initialCategories={categories}
      initialTab={user && params.processing ? "my-books" : "discover"}
      processingBookId={params.processing}
      isAuthenticated={Boolean(user)}
    />
  );
}
