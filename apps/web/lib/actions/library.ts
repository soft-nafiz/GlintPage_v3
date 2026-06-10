"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { categoryNameFromSlug } from "@/lib/library-utils";
import { deleteBookCompletely } from "@/lib/books/delete-book";

export type BookListType = "favorite" | "reading_list";

export type LibraryCategorySummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

export type BookSummary = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  tags: string[];
  cover_url: string | null;
  status: string;
  page_count: number | null;
  created_at: string;
  is_public: boolean;
  source_provider: string | null;
  total_read_seconds: number;
  is_featured: boolean;
  featured_rank: number;
  categories: LibraryCategorySummary[];
  user_read_seconds?: number | null;
  progress_percentage?: number | null;
  current_chunk_index?: number | null;
  last_read_at?: string | null;
  is_favorite?: boolean;
  is_in_reading_list?: boolean;
};

export type LibraryCategory = LibraryCategorySummary & {
  count: number;
  sampleBooks: BookSummary[];
};

type RawBook = {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  tags: string[] | null;
  cover_url: string | null;
  status: string;
  page_count: number | null;
  created_at: string;
  is_public: boolean;
  source_provider: string | null;
  total_read_seconds: number | null;
  is_featured: boolean | null;
  featured_rank: number | null;
};

type RawProgressBook = {
  current_chunk_index: number | null;
  progress_percentage: number | null;
  last_read_at: string | null;
  total_read_seconds?: number | null;
  book: RawBook | RawBook[] | null;
};

type RawProgressState = {
  book_id: string;
  current_chunk_index: number | null;
  progress_percentage: number | null;
  last_read_at: string | null;
  total_read_seconds: number | null;
};

type RawCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

type RawCategoryAssignment = {
  book_id: string;
  category: RawCategory | RawCategory[] | null;
};

const BOOK_SELECT =
  "id, title, author, description, tags, cover_url, status, page_count, created_at, is_public, source_provider, total_read_seconds, is_featured, featured_rank";

function readSeconds(seconds?: number | null) {
  return Math.max(0, Number(seconds || 0));
}

function normalizeBook(book: RawBook): BookSummary {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    description: book.description,
    tags: book.tags || [],
    cover_url: book.cover_url,
    status: book.status,
    page_count: book.page_count,
    created_at: book.created_at,
    is_public: Boolean(book.is_public),
    source_provider: book.source_provider,
    total_read_seconds: readSeconds(book.total_read_seconds),
    is_featured: Boolean(book.is_featured),
    featured_rank: Number(book.featured_rank || 0),
    categories: [],
  };
}

function progressBook(row: RawProgressBook): BookSummary | null {
  const rawBook = Array.isArray(row.book) ? row.book[0] : row.book;
  if (!rawBook) return null;
  return {
    ...normalizeBook(rawBook),
    user_read_seconds: readSeconds(row.total_read_seconds),
    progress_percentage: row.progress_percentage,
    current_chunk_index: row.current_chunk_index,
    last_read_at: row.last_read_at,
  };
}

async function getUserListState(bookIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || bookIds.length === 0) {
    return new Map<string, Set<BookListType>>();
  }

  const { data, error } = await supabase
    .from("book_user_lists")
    .select("book_id, list_type")
    .eq("user_id", user.id)
    .in("book_id", bookIds);

  if (error) {
    console.error("[library:list-state]", error.message);
    return new Map<string, Set<BookListType>>();
  }

  const state = new Map<string, Set<BookListType>>();
  for (const row of data || []) {
    const set = state.get(row.book_id) || new Set<BookListType>();
    if (row.list_type === "favorite" || row.list_type === "reading_list") {
      set.add(row.list_type);
    }
    state.set(row.book_id, set);
  }
  return state;
}

async function getUserProgressState(bookIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || bookIds.length === 0) {
    return new Map<string, RawProgressState>();
  }

  const { data, error } = await supabase
    .from("reading_progress")
    .select(
      "book_id, current_chunk_index, progress_percentage, last_read_at, total_read_seconds",
    )
    .eq("user_id", user.id)
    .in("book_id", bookIds);

  if (error) {
    console.error("[library:progress-state]", error.message);
    return new Map<string, RawProgressState>();
  }

  return new Map(
    ((data || []) as RawProgressState[]).map((row) => [row.book_id, row]),
  );
}

async function withCategories(books: BookSummary[]) {
  if (!books.length) return books;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("book_category_assignments")
    .select(
      "book_id, category:library_categories(id, slug, name, description, sort_order, is_active)",
    )
    .in(
      "book_id",
      books.map((book) => book.id),
    );

  if (error) {
    console.error("[library:categories]", error.message);
    return books;
  }

  const byBook = new Map<string, LibraryCategorySummary[]>();
  for (const row of (data || []) as RawCategoryAssignment[]) {
    const category = Array.isArray(row.category) ? row.category[0] : row.category;
    if (!category || category.is_active === false) continue;
    const next = byBook.get(row.book_id) || [];
    next.push({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
    });
    byBook.set(row.book_id, next);
  }

  return books.map((book) => ({
    ...book,
    categories: (byBook.get(book.id) || []).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  }));
}

async function decorateBooks(books: BookSummary[]) {
  const categorized = await withCategories(books);
  const bookIds = categorized.map((book) => book.id);
  const [listState, progressState] = await Promise.all([
    getUserListState(bookIds),
    getUserProgressState(bookIds),
  ]);

  return categorized.map((book) => {
    const saved = listState.get(book.id);
    const progress = progressState.get(book.id);
    return {
      ...book,
      is_favorite: Boolean(saved?.has("favorite")),
      is_in_reading_list: Boolean(saved?.has("reading_list")),
      user_read_seconds: readSeconds(progress?.total_read_seconds),
      progress_percentage:
        progress?.progress_percentage ?? book.progress_percentage ?? null,
      current_chunk_index:
        progress?.current_chunk_index ?? book.current_chunk_index ?? null,
      last_read_at: progress?.last_read_at ?? book.last_read_at ?? null,
    };
  });
}

function matchesBookSearch(book: BookSummary, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    book.title.toLowerCase().includes(q) ||
    (book.author || "").toLowerCase().includes(q) ||
    (book.description || "").toLowerCase().includes(q) ||
    book.tags.some((tag) => tag.toLowerCase().includes(q)) ||
    book.categories.some((category) => category.name.toLowerCase().includes(q))
  );
}

async function getPublicBookPool(limit = 120) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .select(BOOK_SELECT)
    .eq("is_public", true)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[public-books]", error.message);
    return [];
  }

  return decorateBooks(((data || []) as RawBook[]).map(normalizeBook));
}

export async function searchPublicBooks(query: string): Promise<BookSummary[]> {
  const books = await getPublicBookPool(180);
  return books.filter((book) => matchesBookSearch(book, query)).slice(0, 80);
}

export async function getFeaturedPublicBooks(): Promise<BookSummary[]> {
  const books = await getPublicBookPool(180);
  return books
    .filter((book) => book.is_featured)
    .sort(
      (a, b) =>
        a.featured_rank - b.featured_rank ||
        Date.parse(b.created_at) - Date.parse(a.created_at),
    )
    .slice(0, 12);
}

export async function getMyBooks(): Promise<BookSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("books")
    .select(BOOK_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getMyBooks]", error.message);
    return [];
  }

  return decorateBooks(((data || []) as RawBook[]).map(normalizeBook));
}

export async function getUserListBooks(
  listType: BookListType,
): Promise<BookSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("book_user_lists")
    .select(`book:books(${BOOK_SELECT})`)
    .eq("user_id", user.id)
    .eq("list_type", listType)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getUserListBooks]", error.message);
    return [];
  }

  const books = (data || [])
    .map((row) => {
      const book = Array.isArray(row.book) ? row.book[0] : row.book;
      return book ? normalizeBook(book as RawBook) : null;
    })
    .filter(Boolean) as BookSummary[];

  return decorateBooks(books);
}

export async function getContinueReadingBooks(): Promise<BookSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("reading_progress")
    .select(
      `current_chunk_index, progress_percentage, last_read_at, total_read_seconds, book:books(${BOOK_SELECT})`,
    )
    .eq("user_id", user.id)
    .order("last_read_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("[getContinueReadingBooks]", error.message);
    return [];
  }

  const books = ((data || []) as RawProgressBook[])
    .map(progressBook)
    .filter(Boolean) as BookSummary[];
  return decorateBooks(books);
}

export async function getLibraryCategories(): Promise<LibraryCategory[]> {
  const [categories, books] = await Promise.all([
    getActiveCategorySummaries(),
    getPublicBookPool(240),
  ]);

  return categories.map((category) => {
    const matching = books.filter((book) =>
      book.categories.some((item) => item.id === category.id),
    );
    return {
      ...category,
      count: matching.length,
      sampleBooks: matching.slice(0, 4),
    };
  });
}

export async function getCategoryBooks(slug: string): Promise<{
  category: LibraryCategory | null;
  books: BookSummary[];
}> {
  const [categories, books] = await Promise.all([
    getActiveCategorySummaries(),
    getPublicBookPool(240),
  ]);
  const fallback = {
    id: "",
    slug,
    name: categoryNameFromSlug(slug),
    description: null,
  };
  const category = categories.find((item) => item.slug === slug) || fallback;
  const matching = books.filter((book) =>
    book.categories.some((item) => item.slug === slug),
  );

  return {
    category: matching.length
      ? { ...category, count: matching.length, sampleBooks: matching.slice(0, 4) }
      : null,
    books: matching,
  };
}

export async function getPublicBookDetails(
  bookId: string,
): Promise<BookSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("books")
    .select(BOOK_SELECT)
    .eq("id", bookId)
    .eq("is_public", true)
    .eq("status", "completed")
    .maybeSingle();

  if (error) {
    console.error("[getPublicBookDetails]", error.message);
    return null;
  }

  if (!data) return null;
  return (await decorateBooks([normalizeBook(data as RawBook)])).at(0) || null;
}

export async function getRelatedPublicBooks(book: BookSummary): Promise<BookSummary[]> {
  const books = await searchPublicBooks("");
  const tagSet = new Set(book.tags.map((tag) => tag.toLowerCase()));
  const categorySet = new Set(book.categories.map((category) => category.id));

  return books
    .filter((candidate) => candidate.id !== book.id)
    .map((candidate) => ({
      book: candidate,
      score:
        candidate.categories.filter((category) => categorySet.has(category.id)).length * 10 +
        candidate.tags.filter((tag) => tagSet.has(tag.toLowerCase())).length * 4 +
        (book.author && candidate.author === book.author ? 4 : 0) +
        Math.min(candidate.total_read_seconds / 3600, 3),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.book)
    .slice(0, 10);
}

export async function toggleBookList(bookId: string, listType: BookListType) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: existing } = await supabase
    .from("book_user_lists")
    .select("book_id")
    .eq("user_id", user.id)
    .eq("book_id", bookId)
    .eq("list_type", listType)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("book_user_lists")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .eq("list_type", listType);
    if (error) return { error: error.message };
    revalidatePath("/library");
    revalidatePath(`/books/${bookId}`);
    return { active: false };
  }

  const { error } = await supabase.from("book_user_lists").insert({
    user_id: user.id,
    book_id: bookId,
    list_type: listType,
  });

  if (error) return { error: error.message };
  revalidatePath("/library");
  revalidatePath(`/books/${bookId}`);
  return { active: true };
}

export async function deleteUserBook(bookId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  return deleteBookCompletely(bookId, { type: "user", user });
}

async function getActiveCategorySummaries(): Promise<LibraryCategorySummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("library_categories")
    .select("id, slug, name, description, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[library:active-categories]", error.message);
    return [];
  }

  return ((data || []) as RawCategory[]).map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: category.description,
  }));
}
