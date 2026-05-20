"use server";

import { createClient } from "@/lib/supabase/server";

export type BookSummary = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  status: string;
  page_count: number | null;
  created_at: string;
};

export async function searchPublicBooks(query: string): Promise<BookSummary[]> {
  const supabase = await createClient();

  const q = query.trim();

  let request = supabase
    .from("books")
    .select("id, title, author, cover_url, status, page_count, created_at")
    .eq("is_public", true)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(40);

  if (q) {
    request = request.or(`title.ilike.%${q}%,author.ilike.%${q}%`);
  }

  const { data, error } = await request;
  if (error) {
    console.error("[searchPublicBooks]", error.message);
    return [];
  }

  return data ?? [];
}

export async function getMyBooks(): Promise<BookSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("books")
    .select("id, title, author, cover_url, status, page_count, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getMyBooks]", error.message);
    return [];
  }

  return data ?? [];
}
