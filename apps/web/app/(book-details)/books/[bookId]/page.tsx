import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen, Clock, Library, Sparkles } from "lucide-react";
import {
  getPublicBookDetails,
  getRelatedPublicBooks,
  type BookSummary,
} from "@/lib/actions/library";
import { formatReadingDuration, slugifyCategory } from "@/lib/library-utils";
import { getCurrentUser } from "@/lib/auth/server";
import { absoluteUrl, createMetadata, jsonLd, siteConfig } from "@/lib/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookDetailActions } from "@/components/library/book-detail-actions";
import { BookDetailsBackButton } from "@/components/library/book-details-back-button";
import {
  bookRating,
  MarkdownDescription,
} from "@/components/library/book-metadata";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";

function sourceLabel(source?: string | null) {
  if (!source) return "Glintpage";
  return source
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function Cover({ book }: { book: BookSummary }) {
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border bg-muted">
      {book.cover_url ? (
        <Image
          src={book.cover_url}
          alt={book.title}
          fill
          priority
          sizes="(max-width: 768px) 45vw, 260px"
          className="object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <div className="flex h-full w-full items-end bg-gradient-to-br from-primary/80 to-foreground p-5 text-primary-foreground">
          <div>
            <p className="text-xs uppercase opacity-70">
              {book.author || "Glintpage"}
            </p>
            <p className="text-2xl font-bold leading-none">{book.title}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bookId: string }>;
}): Promise<Metadata> {
  const { bookId } = await params;
  const book = await getPublicBookDetails(bookId);
  if (!book) {
    return createMetadata({
      title: "Book not found",
      description: "This Glintpage book could not be found.",
      path: `/books/${bookId}`,
      noIndex: true,
    });
  }

  return createMetadata({
    title: `${book.title}${book.author ? ` by ${book.author}` : ""}`,
    description:
      book.description ||
      `Read ${book.title}${book.author ? ` by ${book.author}` : ""} on Glintpage.`,
    path: `/books/${book.id}`,
    image: book.cover_url || siteConfig.image,
    keywords: [book.title, book.author || "", ...book.tags].filter(Boolean),
    type: "article",
  });
}

export default async function BookDetailsPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await getPublicBookDetails(bookId);
  if (!book) notFound();

  const [relatedBooks, user] = await Promise.all([
    getRelatedPublicBooks(book),
    getCurrentUser(),
  ]);
  const { rating, reviewCount } = bookRating(book);
  const libraryHref = user ? "/dashboard/library" : "/library";

  const bookJsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: book.author ? { "@type": "Person", name: book.author } : undefined,
    description: book.description || undefined,
    image: book.cover_url ? absoluteUrl(book.cover_url) : undefined,
    url: absoluteUrl(`/books/${book.id}`),
    genre: book.tags,
    aggregateRating:
      reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: rating,
            reviewCount,
          }
        : undefined,
    isAccessibleForFree: true,
    provider: {
      "@type": "Organization",
      name: "Glintpage",
      url: siteConfig.url,
    },
  };

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(bookJsonLd)}
      />
      <div className="sticky py-2 top-0 px-4 z-50 w-full flex items-center justify-start bg-background/50 backdrop-blur-2xl">
        <BookDetailsBackButton fallbackHref={libraryHref} />
      </div>
      <MaxWidthWrapper className="max-w-6xl py-8">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <Cover book={book} />

          <section className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
              {book.tags.slice(0, 4).map((tag) => (
                <Link
                  key={tag}
                  href={`/library/category/${slugifyCategory(tag)}`}
                >
                  <Badge variant="secondary">{tag}</Badge>
                </Link>
              ))}
            </div>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
              {book.title}
            </h1>
            <p className="mt-3 text-lg font-medium text-muted-foreground">
              {book.author || "Unknown author"}
            </p>

            <MarkdownDescription className="mt-6 max-w-3xl text-base leading-7">
              {book.description ||
                "This public-domain book is available to read in Glintpage."}
            </MarkdownDescription>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                icon={BookOpen}
                label="Pages"
                value={book.page_count ? String(book.page_count) : "Ready"}
              />
              <Metric
                icon={Clock}
                label="Total read time"
                value={formatReadingDuration(
                  book.total_read_seconds,
                  "No reads yet",
                )}
              />
              <Metric
                icon={Sparkles}
                label="Your reading time"
                value={
                  user
                    ? formatReadingDuration(book.user_read_seconds, "0 min")
                    : "Log in to track"
                }
              />
              <Metric
                icon={Library}
                label="Source"
                value={sourceLabel(book.source_provider)}
              />
            </div>

            <div className="mt-7">
              <BookDetailActions book={book} isAuthenticated={Boolean(user)} />
            </div>
          </section>
        </div>

        <section className="mt-14">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight">Related books</h2>
            <Button asChild variant="outline">
              <Link href={libraryHref}>Explore library</Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedBooks.slice(0, 8).map((related) => (
              <Link
                key={related.id}
                href={`/books/${related.id}`}
                className="rounded-2xl border bg-card p-3 transition hover:-translate-y-0.5 hover:bg-muted/30"
              >
                <div className="flex gap-3">
                  <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {related.cover_url ? (
                      <Image
                        src={related.cover_url}
                        alt={related.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                        crossOrigin="anonymous"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-sm font-semibold">
                      {related.title}
                    </h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {related.author || "Unknown author"}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {formatReadingDuration(
                        related.total_read_seconds,
                        "No reads yet",
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </MaxWidthWrapper>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
