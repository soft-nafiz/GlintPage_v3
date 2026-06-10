import { createClient } from "@/lib/supabase/server";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId");
  const pageNumber = parseInt(searchParams.get("pageNumber") ?? "1");

  if (!bookId || !Number.isFinite(pageNumber) || pageNumber < 1) {
    return NextResponse.json({ error: "Invalid page request" }, { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let bookRequest = supabase
    .from("books")
    .select("id")
    .eq("id", bookId)
    .eq("status", "completed");

  bookRequest = user
    ? bookRequest.or(`user_id.eq.${user.id},is_public.eq.true`)
    : bookRequest.eq("is_public", true);

  const { data: book } = await bookRequest.maybeSingle();

  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  const { data: page } = await supabase
    .from("book_pages")
    .select(
      "id, page_number, content, chapter_number, chapter_title, render_type, render_content, ai_text, asset_manifest",
    )
    .eq("book_id", bookId)
    .eq("page_number", pageNumber)
    .maybeSingle();

  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  return NextResponse.json({ page });
}
