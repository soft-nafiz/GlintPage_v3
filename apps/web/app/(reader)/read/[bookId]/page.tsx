import { notFound, redirect } from "next/navigation";
import { ChapterTOC, ReaderClient } from "@/components/reader/reader-client";
import { createClient } from "@/lib/supabase/server";

export default async function page({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Fetch book
  const { data: book } = await supabase
    .from("books")
    .select("id, title, author, cover_url, status, page_count")
    .eq("id", bookId)
    .or(`user_id.eq.${user.id},is_public.eq.true`)
    .single();

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

  const totalPages = book.page_count ?? 0;
  const savedIndex = progress?.current_chunk_index ?? 1;
  const startIndex =
    totalPages > 0 ? Math.min(Math.max(savedIndex, 1), totalPages) : 1;

  const { data: profile } = await supabase
    .from("profiles")
    .select("prefetch_enabled")
    .eq("id", user.id)
    .maybeSingle();

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
    />
  );
}
