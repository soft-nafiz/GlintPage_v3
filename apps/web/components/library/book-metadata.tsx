import { Star } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { BookSummary } from "@/lib/actions/library";
import { cn } from "@/lib/utils";

export function bookRating(book: BookSummary) {
  const rating = Number(book.rating ?? 0);
  const reviewCount = Number(book.review_count ?? 0);

  return {
    rating: Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0,
    reviewCount: Number.isFinite(reviewCount) ? Math.max(0, reviewCount) : 0,
  };
}

export function ReviewSummary({
  book,
  className,
}: {
  book: BookSummary;
  className?: string;
}) {
  const { rating, reviewCount } = bookRating(book);
  const filledStars = Math.round(rating);

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-0.5 text-primary">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star
            key={index}
            className={cn(
              "size-3.5",
              index < filledStars ? "fill-current" : "fill-transparent",
            )}
          />
        ))}
      </div>
      <span className="truncate">
        {rating > 0 ? `${rating.toFixed(1)} · ` : ""}
        {reviewCount.toLocaleString()} reviews
      </span>
    </div>
  );
}

export function MarkdownDescription({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-muted-foreground [&_a]:text-primary [&_em]:italic [&_strong]:font-semibold [&_strong]:text-foreground",
        className,
      )}
    >
      <ReactMarkdown
        components={{
          p: ({ children }) => <span>{children}</span>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
