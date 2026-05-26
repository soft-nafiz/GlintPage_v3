import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyBooks, searchPublicBooks } from "@/lib/actions/library";
import { LibraryClient } from "@/components/library/library-client";

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Fetch both in parallel
  const [myBooks, publicBooks] = await Promise.all([
    getMyBooks(),
    searchPublicBooks(""), // initial load, no query
  ]);

  return (
    <LibraryClient initialMyBooks={myBooks} initialPublicBooks={publicBooks} />
  );
}
