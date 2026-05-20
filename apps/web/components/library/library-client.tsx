"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import {
  searchPublicBooks,
  getMyBooks,
  type BookSummary,
} from "@/lib/actions/library";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  BookOpen,
  Clock,
  AlertCircle,
  Loader2,
  Library,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UploadBookDialog } from "../upload/upload-book-dialog";

// ── Book Card ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  completed: {
    label: "Ready",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  },
  processing: {
    label: "Processing",
    color: "bg-amber-500/10 text-amber-600 border-amber-200",
  },
  pending: {
    label: "Queued",
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
  },
  failed: {
    label: "Failed",
    color: "bg-red-500/10 text-red-600 border-red-200",
  },
} as const;

function CoverPlaceholder({ title }: { title: string }) {
  // Generate a stable muted color from title
  const colors = [
    "from-amber-100 to-amber-200",
    "from-blue-100 to-blue-200",
    "from-violet-100 to-violet-200",
    "from-emerald-100 to-emerald-200",
    "from-rose-100 to-rose-200",
    "from-slate-100 to-slate-200",
  ];
  const idx = title.charCodeAt(0) % colors.length;

  return (
    <div
      className={`w-full h-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center`}
    >
      <span className="text-3xl font-serif font-bold text-gray-400/60 select-none">
        {title.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

function BookCard({
  book,
  showStatus = false,
}: {
  book: BookSummary;
  showStatus?: boolean;
}) {
  const status = STATUS_CONFIG[book.status as keyof typeof STATUS_CONFIG];
  const isReady = book.status === "completed";
  const isProcessing =
    book.status === "processing" || book.status === "pending";

  const card = (
    <div
      className={`group relative flex flex-col rounded-xl overflow-hidden border border-gray-100 bg-white shadow-sm transition-all duration-200 ${
        isReady
          ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
          : "cursor-default"
      }`}
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] overflow-hidden bg-gray-50">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <CoverPlaceholder title={book.title} />
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
            <span className="text-white text-xs font-medium">Processing</span>
          </div>
        )}

        {/* Failed overlay */}
        {book.status === "failed" && (
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <span className="text-white text-xs font-medium">Failed</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
          {book.title}
        </p>
        {book.author && (
          <p className="text-xs text-gray-400 truncate">{book.author}</p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2">
          {book.page_count ? (
            <span className="text-[10px] text-gray-300 flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {book.page_count}p
            </span>
          ) : (
            <span />
          )}

          {showStatus && status && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${status.color}`}
            >
              {status.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (!isReady) return card;

  return <Link href={`/read/${book.id}`}>{card}</Link>;
}

// ── Empty States ──────────────────────────────────────────────────────────────

function EmptyMyBooks() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
        <Upload className="w-7 h-7 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-600 mb-1">No books yet</p>
      <p className="text-xs text-gray-400 mb-5">
        Upload a PDF or EPUB to get started
      </p>
      <Button size="sm" variant="outline" className="rounded-xl">
        Upload a book
      </Button>
    </div>
  );
}

function EmptySearch({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
        <Library className="w-7 h-7 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-600 mb-1">
        {query ? `No results for "${query}"` : "Public library is empty"}
      </p>
      <p className="text-xs text-gray-400">
        {query ? "Try a different title or author name" : "Check back soon"}
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function LibraryClient({
  initialMyBooks,
  initialPublicBooks,
}: {
  initialMyBooks: BookSummary[];
  initialPublicBooks: BookSummary[];
}) {
  const [myBooks, setMyBooks] = useState(initialMyBooks);
  const [publicBooks, setPublicBooks] = useState(initialPublicBooks);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, startSearch] = useTransition();
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Poll my books every 5s if any are still processing
  const hasProcessing = myBooks.some(
    (b) => b.status === "pending" || b.status === "processing",
  );

  useEffect(() => {
    if (!hasProcessing) return;

    const interval = setInterval(async () => {
      const updated = await getMyBooks();
      setMyBooks(updated);
    }, 5000);

    return () => clearInterval(interval);
  }, [hasProcessing]);

  // Debounced search for public books
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    clearTimeout(searchDebounce.current);

    searchDebounce.current = setTimeout(() => {
      startSearch(async () => {
        const results = await searchPublicBooks(query);
        setPublicBooks(results);
      });
    }, 350);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => () => clearTimeout(searchDebounce.current), []);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1
              className="text-lg font-semibold text-gray-900"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Library
            </h1>
          </div>
          <UploadBookDialog />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Tabs defaultValue="discover">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <TabsList className="rounded-xl bg-gray-100 p-1">
              <TabsTrigger
                value="discover"
                className="rounded-lg gap-2 text-sm"
              >
                <Library className="w-4 h-4" />
                Discover
              </TabsTrigger>
              <TabsTrigger
                value="my-books"
                className="rounded-lg gap-2 text-sm"
              >
                <BookOpen className="w-4 h-4" />
                My Books
                {myBooks.length > 0 && (
                  <span className="ml-1 bg-gray-200 text-gray-600 rounded-full text-[10px] font-semibold px-1.5 py-px">
                    {myBooks.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Search — only visible on Discover tab via CSS trick */}
            <TabsContent value="discover" className="mt-0 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by title or author..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 pr-4 w-full sm:w-72 rounded-xl border-gray-200 bg-white"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                )}
              </div>
            </TabsContent>
          </div>

          {/* Discover Tab */}
          <TabsContent value="discover">
            {publicBooks.length === 0 ? (
              <EmptySearch query={searchQuery} />
            ) : (
              <div
                className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 transition-opacity ${isSearching ? "opacity-50" : "opacity-100"}`}
              >
                {publicBooks.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* My Books Tab */}
          <TabsContent value="my-books">
            {myBooks.length === 0 ? (
              <EmptyMyBooks />
            ) : (
              <>
                {/* Processing notice */}
                {hasProcessing && (
                  <div className="flex items-center gap-2 mb-6 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
                    <Clock className="w-4 h-4 shrink-0" />
                    Some books are still processing — this page refreshes
                    automatically.
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {myBooks.map((book) => (
                    <BookCard key={book.id} book={book} showStatus />
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
