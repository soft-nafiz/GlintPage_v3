"use server";

import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { getAdminUser } from "@/lib/admin/books";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { slugifyCategory } from "@/lib/library-utils";
import { deleteBookCompletely } from "@/lib/books/delete-book";

export type AdminCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type AdminPublicBook = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  tags: string[];
  cover_url: string | null;
  status: string;
  source_provider: string | null;
  source_url: string | null;
  is_featured: boolean;
  featured_rank: number;
  created_at: string;
  categories: AdminCategory[];
};

type RawAdminBook = Omit<AdminPublicBook, "tags" | "categories"> & {
  tags: string[] | null;
};

type RawAssignment = {
  book_id: string;
  category: AdminCategory | AdminCategory[] | null;
};

export type AdminBooksDashboardData = {
  adminEmail: string;
  books: AdminPublicBook[];
  categories: AdminCategory[];
};

export type AdminBookUpdateInput = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  tags: string[];
  cover_url: string | null;
  source_provider: string | null;
  source_url: string | null;
  is_featured: boolean;
  featured_rank: number;
  categoryIds: string[];
};

export type AdminCategoryInput = {
  id?: string;
  name: string;
  slug?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

const ADMIN_BOOK_SELECT =
  "id, title, author, description, tags, cover_url, status, source_provider, source_url, is_featured, featured_rank, created_at";

export async function getAdminBooksDashboardData(): Promise<AdminBooksDashboardData | null> {
  const admin = await getAdminUser();
  if (!admin) return null;

  const [booksResult, categoriesResult] = await Promise.all([
    supabaseAdmin
      .from("books")
      .select(ADMIN_BOOK_SELECT)
      .eq("is_public", true)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("library_categories")
      .select("id, slug, name, description, sort_order, is_active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  if (booksResult.error) throw new Error(booksResult.error.message);
  if (categoriesResult.error) throw new Error(categoriesResult.error.message);

  const categories = (categoriesResult.data || []) as AdminCategory[];
  const books: AdminPublicBook[] = ((booksResult.data || []) as RawAdminBook[]).map((book) => ({
    ...book,
    tags: book.tags || [],
    categories: [],
  }));

  const bookIds = books.map((book) => book.id);
  if (bookIds.length) {
    const { data, error } = await supabaseAdmin
      .from("book_category_assignments")
      .select("book_id, category:library_categories(id, slug, name, description, sort_order, is_active)")
      .in("book_id", bookIds);
    if (error) throw new Error(error.message);

    const byBook = new Map<string, AdminCategory[]>();
    for (const row of (data || []) as RawAssignment[]) {
      const category = Array.isArray(row.category) ? row.category[0] : row.category;
      if (!category) continue;
      byBook.set(row.book_id, [...(byBook.get(row.book_id) || []), category]);
    }

    for (const book of books) {
      book.categories = byBook.get(book.id) || [];
    }
  }

  return {
    adminEmail: admin.email || "Admin",
    books,
    categories,
  };
}

export async function updateAdminPublicBook(input: AdminBookUpdateInput) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin;

  const { error } = await supabaseAdmin
    .from("books")
    .update({
      title: input.title.trim(),
      author: input.author?.trim() || null,
      description: input.description?.trim() || null,
      tags: input.tags.map((tag) => tag.trim()).filter(Boolean),
      cover_url: input.cover_url?.trim() || null,
      source_provider: input.source_provider?.trim() || null,
      source_url: input.source_url?.trim() || null,
      is_featured: input.is_featured,
      featured_rank: Number(input.featured_rank || 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("is_public", true);

  if (error) return { error: error.message };

  const { error: deleteError } = await supabaseAdmin
    .from("book_category_assignments")
    .delete()
    .eq("book_id", input.id);
  if (deleteError) return { error: deleteError.message };

  const rows = [...new Set(input.categoryIds)].map((categoryId) => ({
    book_id: input.id,
    category_id: categoryId,
  }));
  if (rows.length) {
    const { error: insertError } = await supabaseAdmin
      .from("book_category_assignments")
      .insert(rows);
    if (insertError) return { error: insertError.message };
  }

  revalidateAdminAndLibrary(input.id);
  return { success: true };
}

export async function deleteAdminPublicBook(bookId: string) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin;
  return deleteBookCompletely(bookId, { type: "admin", user: admin.user });
}

export async function upsertAdminCategory(input: AdminCategoryInput) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin;

  const name = input.name.trim();
  const slug = slugifyCategory(input.slug || name);
  if (!name) return { error: "Category name is required." };
  if (!slug) return { error: "Category slug is required." };

  const payload = {
    name,
    slug,
    description: input.description?.trim() || null,
    sort_order: Number(input.sort_order || 0),
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabaseAdmin.from("library_categories").update(payload).eq("id", input.id)
    : supabaseAdmin.from("library_categories").insert(payload);

  const { error } = await query;
  if (error) return { error: error.message };

  revalidatePath("/library");
  revalidatePath("/admin/books");
  return { success: true };
}

export async function deleteAdminCategory(categoryId: string) {
  const admin = await requireAdmin();
  if ("error" in admin) return admin;

  const { error } = await supabaseAdmin
    .from("library_categories")
    .delete()
    .eq("id", categoryId);

  if (error) return { error: error.message };
  revalidatePath("/library");
  revalidatePath("/admin/books");
  return { success: true };
}

async function requireAdmin(): Promise<{ user: User } | { error: string }> {
  const user = await getAdminUser();
  if (!user) return { error: "Admin access required." };
  return { user };
}

function revalidateAdminAndLibrary(bookId: string) {
  revalidatePath("/library");
  revalidatePath(`/books/${bookId}`);
  revalidatePath(`/read/${bookId}`);
  revalidatePath("/admin/books");
}
