import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BOOK_STORAGE_BUCKET =
  process.env.SUPABASE_BOOK_BUCKET ||
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
  "library";

const DELETE_QUERY_CHUNK_SIZE = 100;
const STORAGE_DELETE_CHUNK_SIZE = 100;

type DeleteBookMode =
  | { type: "user"; user: User }
  | { type: "admin"; user: User };

type BookDeleteRecord = {
  id: string;
  user_id: string | null;
  title: string;
  file_path: string | null;
  cover_url: string | null;
  is_public: boolean | null;
};

type PageDeleteRecord = {
  id: string;
  asset_manifest: Record<string, unknown> | null;
};

type AudioDeleteRecord = {
  audio_url: string | null;
};

export async function deleteBookCompletely(
  bookId: string,
  mode: DeleteBookMode,
) {
  const fail = (step: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[deleteBookCompletely]", {
      bookId,
      mode: mode.type,
      step,
      error: message,
    });
    return { error: `${step}: ${message}` };
  };

  try {
    const { data: book, error: bookError } = await supabaseAdmin
      .from("books")
      .select("id, user_id, title, file_path, cover_url, is_public")
      .eq("id", bookId)
      .maybeSingle<BookDeleteRecord>();

    if (bookError) return fail("Load book", bookError.message);
    if (!book) return { error: "Book not found." };

    if (mode.type === "user") {
      if (book.user_id !== mode.user.id) return { error: "Book not found." };
      if (book.is_public)
        return {
          error: "Public library books can only be deleted by an admin.",
        };
    }

    if (mode.type === "admin" && !book.is_public) {
      return { error: "Admin deletion is limited to public books." };
    }

    const warnings: string[] = [];
    const storagePaths = new Set<string>();
    if (book.file_path) storagePaths.add(book.file_path);
    addStoragePathFromUrl(storagePaths, book.cover_url);

    const { data: pages, error: pagesError } = await supabaseAdmin
      .from("book_pages")
      .select("id, asset_manifest")
      .eq("book_id", book.id)
      .returns<PageDeleteRecord[]>();

    if (pagesError) return fail("Load book pages", pagesError.message);

    for (const page of pages || []) {
      for (const value of Object.values(page.asset_manifest || {})) {
        if (typeof value === "string")
          addStoragePathFromUrl(storagePaths, value);
      }
    }

    const pageIds = (pages || []).map((page) => page.id);
    if (pageIds.length) {
      for (const chunk of chunkArray(pageIds, DELETE_QUERY_CHUNK_SIZE)) {
        const { data: audioRows, error: audioLookupError } = await supabaseAdmin
          .from("audio_pages")
          .select("audio_url")
          .in("page_id", chunk)
          .returns<AudioDeleteRecord[]>();

        if (audioLookupError)
          return fail("Load audio cache", audioLookupError.message);
        for (const row of audioRows || [])
          addStoragePathFromUrl(storagePaths, row.audio_url);
      }
    }

    const { error: importJobError } = await supabaseAdmin
      .from("admin_book_import_jobs")
      .update({ book_id: null })
      .eq("book_id", book.id);

    if (importJobError)
      return fail("Detach import jobs", importJobError.message);

    const { error: deleteBookError } = await supabaseAdmin
      .from("books")
      .delete()
      .eq("id", book.id);

    if (deleteBookError) return fail("Delete book", deleteBookError.message);

    const paths = [...storagePaths].filter(Boolean);
    if (paths.length) {
      for (const chunk of chunkArray(paths, STORAGE_DELETE_CHUNK_SIZE)) {
        const { error: storageError } = await supabaseAdmin.storage
          .from(BOOK_STORAGE_BUCKET)
          .remove(chunk);
        if (storageError) {
          console.warn("[deleteBookCompletely] Storage cleanup failed", {
            bookId,
            paths: chunk,
            error: storageError.message,
          });
          warnings.push(storageError.message);
        }
      }
    }

    revalidatePath("/library");
    revalidatePath(`/books/${book.id}`);
    revalidatePath(`/read/${book.id}`);
    revalidatePath("/admin/books");

    return { success: true as const, warnings };
  } catch (error) {
    return fail("Unexpected delete failure", error);
  }
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function addStoragePathFromUrl(paths: Set<string>, value?: string | null) {
  const path = storagePathFromPublicUrl(value);
  if (path) paths.add(path);
}

function storagePathFromPublicUrl(value?: string | null) {
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) return normalizeStoragePath(value);

  try {
    const url = new URL(value);
    const publicPrefix = `/storage/v1/object/public/${BOOK_STORAGE_BUCKET}/`;
    const authenticatedPrefix = `/storage/v1/object/${BOOK_STORAGE_BUCKET}/`;
    let pathname = url.pathname;

    if (pathname.startsWith(publicPrefix)) {
      pathname = pathname.slice(publicPrefix.length);
    } else if (pathname.startsWith(authenticatedPrefix)) {
      pathname = pathname.slice(authenticatedPrefix.length);
    } else {
      return null;
    }

    return normalizeStoragePath(decodeURIComponent(pathname));
  } catch {
    return null;
  }
}

function normalizeStoragePath(value: string) {
  const clean = value.trim().replace(/^\/+/, "");
  if (!clean || clean.includes("..")) return null;
  return clean;
}
