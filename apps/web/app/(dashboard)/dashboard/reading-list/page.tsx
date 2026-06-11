import { LibraryClient } from "@/components/library/library-client";
import { getUserListBooks } from "@/lib/actions/library";
import { createMetadata } from "@/lib/seo";
import { requireCurrentUser } from "@/lib/auth/server";

export const metadata = createMetadata({
  title: "Reading list",
  description: "Open the books you saved for later in Glintpage.",
  path: "/dashboard/reading-list",
  noIndex: true,
});

export default async function ReadingListPage() {
  await requireCurrentUser();

  const readingList = await getUserListBooks("reading_list");

  return (
    <LibraryClient
      mode="reading-list"
      initialMyBooks={[]}
      initialPublicBooks={[]}
      initialFeaturedBooks={[]}
      initialFavorites={[]}
      initialReadingList={readingList}
      initialCategories={[]}
      isAuthenticated
    />
  );
}
