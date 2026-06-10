import { createClient } from "@/lib/supabase/server";
import { getMyBooks, searchPublicBooks } from "@/lib/actions/library";
import { LibraryClient } from "@/components/library/library-client";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ processing?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch both in parallel
  const [myBooks, publicBooks] = await Promise.all([
    user ? getMyBooks() : Promise.resolve([]),
    searchPublicBooks(""), // initial load, no query
  ]);

  const params = await searchParams;

  return (
    <LibraryClient
      initialMyBooks={myBooks}
      initialPublicBooks={publicBooks}
      initialTab={user && params.processing ? "my-books" : "discover"}
      processingBookId={params.processing}
      isAuthenticated={Boolean(user)}
    />
  );
}
