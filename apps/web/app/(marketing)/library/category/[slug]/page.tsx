import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookOpen, Clock } from "lucide-react";
import {
  getCategoryBooks,
} from "@/lib/actions/library";
import { categoryNameFromSlug, formatReadingDuration } from "@/lib/library-utils";
import { createMetadata } from "@/lib/seo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const name = categoryNameFromSlug(slug);
  return createMetadata({
    title: `${name} Books`,
    description: `Browse ${name.toLowerCase()} books in the Glintpage public library.`,
    path: `/library/category/${slug}`,
    keywords: [`${name} books`, "public domain books", "online reading library"],
  });
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { category, books } = await getCategoryBooks(slug);
  if (!category) notFound();

  return (
    <main className="min-h-screen bg-background pt-16">
      <MaxWidthWrapper className="py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Category
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight">{category.name}</h1>
            <p className="mt-2 text-muted-foreground">
              {category.count} {category.count === 1 ? "book" : "books"} available to read.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/library">Back to library</Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((book) => (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:bg-muted/30"
            >
              <div className="flex gap-4">
                <div className="relative h-32 w-[88px] shrink-0 overflow-hidden rounded-xl bg-muted">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={book.title}
                      fill
                      sizes="88px"
                      className="object-cover"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="flex h-full items-end bg-gradient-to-br from-primary/80 to-foreground p-2 text-xs font-bold text-primary-foreground">
                      {book.title}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-1">
                    {book.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="max-w-28 truncate">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <h2 className="line-clamp-2 font-semibold">{book.title}</h2>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {book.author || "Unknown author"}
                  </p>
                  <p className="mt-3 line-clamp-2 text-sm leading-5 text-muted-foreground">
                    {book.description || "Read this public-domain book in Glintpage."}
                  </p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" />
                      {book.page_count || "Ready"} pages
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatReadingDuration(book.total_read_seconds, "No reads yet")}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </MaxWidthWrapper>
    </main>
  );
}
