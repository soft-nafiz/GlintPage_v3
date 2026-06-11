import { LibraryClient } from "@/components/library/library-client";
import { getMyBooks } from "@/lib/actions/library";
import { createMetadata } from "@/lib/seo";
import { requireCurrentUser } from "@/lib/auth/server";

export const metadata = createMetadata({
  title: "My books",
  description: "Manage your private uploaded books in Glintpage.",
  path: "/dashboard/my-books",
  noIndex: true,
});

export default async function MyBooksPage({
  searchParams,
}: {
  searchParams: Promise<{ processing?: string }>;
}) {
  await requireCurrentUser();

  const [myBooks, params] = await Promise.all([getMyBooks(), searchParams]);

  return (
    <LibraryClient
      mode="my-books"
      initialMyBooks={myBooks}
      initialPublicBooks={[]}
      initialFeaturedBooks={[]}
      initialFavorites={[]}
      initialReadingList={[]}
      initialCategories={[]}
      processingBookId={params.processing}
      isAuthenticated
    />
  );
}
