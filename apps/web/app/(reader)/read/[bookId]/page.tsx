import { notFound } from "next/navigation";
import { ChapterTOC, ReaderClient } from "@/components/reader/reader-client";
import {
  getCurrentProfile,
  getCurrentUser,
  getServerSupabase,
} from "@/lib/auth/server";

export default async function page({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const [supabase, user, profile] = await Promise.all([
    getServerSupabase(),
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  let bookRequest = supabase
    .from("books")
    .select("id, title, author, cover_url, status, page_count")
    .eq("id", bookId)
    .eq("status", "completed");

  bookRequest = user
    ? bookRequest.or(`user_id.eq.${user.id},is_public.eq.true`)
    : bookRequest.eq("is_public", true);

  const { data: book } = await bookRequest.maybeSingle();

  if (!book) notFound();

  // Fetch saved progress
  const { data: progress } = user
    ? await supabase
        .from("reading_progress")
        .select("current_chunk_index")
        .eq("user_id", user.id)
        .eq("book_id", book.id)
        .maybeSingle()
    : { data: null };

  const totalPages = book.page_count ?? 0;
  const savedIndex = progress?.current_chunk_index ?? 1;
  const startIndex =
    totalPages > 0 ? Math.min(Math.max(savedIndex, 1), totalPages) : 1;

  // Fetch first page (now including chapter data)
  const { error: firstpagEerror, data: firstPage } = await supabase
    .from("book_pages")
    .select(
      "id, page_number, content, chapter_number, chapter_title, render_type, render_content, ai_text, asset_manifest",
    )
    .eq("book_id", book.id)
    .eq("page_number", startIndex)
    .single();

  if (firstpagEerror) console.log(firstpagEerror);

  if (!firstPage) notFound();

  // Fetch lightweight TOC data for the sidebar
  const { data: tocData } = await supabase
    .from("book_pages")
    .select("page_number, chapter_number, chapter_title")
    .eq("book_id", book.id)
    .order("page_number", { ascending: true });

  // Group pages into chapters to build the TOC array
  const toc: ChapterTOC[] = [];
  if (tocData) {
    tocData.forEach((page) => {
      const existing = toc.find(
        (c) => c.chapter_number === page.chapter_number,
      );
      if (existing) {
        existing.last_page = page.page_number;
      } else {
        toc.push({
          chapter_number: page.chapter_number,
          chapter_title: page.chapter_title,
          first_page: page.page_number,
          last_page: page.page_number,
        });
      }
    });
  }

  return (
    <ReaderClient
      book={book}
      initialPage={firstPage}
      totalPages={totalPages}
      initialPrefetchEnabled={profile?.prefetch_enabled ?? false}
      toc={toc}
      isAuthenticated={Boolean(user)}
      userPlan={profile?.plan || "free"}
    />
  );
}
