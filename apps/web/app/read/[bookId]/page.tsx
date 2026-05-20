import { notFound, redirect } from "next/navigation";
import { ReaderClient } from "@/components/reader/reader-client";
import { createClient } from "@/lib/supabase/server";

export default async function page({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  console.log(await params);
  // Fetch book
  const { data: book } = await supabase
    .from("books")
    .select("id, title, author, cover_url, status, page_count")
    .eq("id", (await params).bookId)
    .single();

  if (!book) console.log("book not found");
  if (!book) notFound();
  if (book.status !== "completed") {
    redirect(`/library?processing=${book.id}`);
  }

  // Fetch saved progress
  const { data: progress } = await supabase
    .from("reading_progress")
    .select("current_chunk_index")
    .eq("user_id", user.id)
    .eq("book_id", book.id)
    .maybeSingle();

  const startIndex = progress?.current_chunk_index ?? 1;

  // Fetch first page
  const { data: firstPage } = await supabase
    .from("book_pages")
    .select("id, page_number, content")
    .eq("book_id", book.id)
    .eq("page_number", startIndex)
    .single();

  if (!firstPage) console.log("book first page is not found");
  if (!firstPage) notFound();

  // Fetch credit balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("translation_credits, prefetch_enabled")
    .eq("id", user.id)
    .single();

  return (
    <ReaderClient
      book={book}
      initialPage={firstPage}
      totalPages={book.page_count ?? 0}
      initialCredits={profile?.translation_credits ?? 0}
      initialPrefetchEnabled={profile?.prefetch_enabled ?? false}
    />
  );
}
