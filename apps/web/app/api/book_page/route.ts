import { createClient } from "@/lib/supabase/server";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bookId = searchParams.get("bookId");
  const pageNumber = parseInt(searchParams.get("pageNumber") ?? "1");

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: page } = await supabase
    .from("book_pages")
    .select("id, page_number, content")
    .eq("book_id", bookId)
    .eq("page_number", pageNumber)
    .single();

  return NextResponse.json({ page });
}
