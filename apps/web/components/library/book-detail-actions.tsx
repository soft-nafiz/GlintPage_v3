"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Bookmark, Heart, Loader2, Play, Share2 } from "lucide-react";
import { toggleBookList, type BookSummary } from "@/lib/actions/library";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BookDetailActions({
  book,
  isAuthenticated,
}: {
  book: BookSummary;
  isAuthenticated: boolean;
}) {
  const [isFavorite, setIsFavorite] = useState(Boolean(book.is_favorite));
  const [isInReadingList, setIsInReadingList] = useState(
    Boolean(book.is_in_reading_list),
  );
  const [pending, startTransition] = useTransition();

  function toggle(type: "favorite" | "reading_list") {
    if (!isAuthenticated) {
      window.location.href = "/auth/login";
      return;
    }
    const previous = type === "favorite" ? isFavorite : isInReadingList;
    const next = !previous;
    if (type === "favorite") setIsFavorite(next);
    if (type === "reading_list") setIsInReadingList(next);

    startTransition(async () => {
      const result = await toggleBookList(book.id, type);
      if (typeof result.active !== "boolean") {
        if (type === "favorite") setIsFavorite(previous);
        if (type === "reading_list") setIsInReadingList(previous);
        toast.error(result.error || "Could not save this book.");
        return;
      }
      if (type === "favorite") setIsFavorite(result.active);
      if (type === "reading_list") setIsInReadingList(result.active);
    });
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Link href={`/read/${book.id}`} className="flex-1">
        <Button className="h-11 w-full  gap-2 ">
          <Play className="h-4 w-4" />
          Read now
        </Button>
      </Link>
      <Button
        type="button"
        className={cn(
          "h-11 gap-2 bg-transparent border border-border text-foreground",
          isFavorite &&
            " bg-primary text-primary-foreground hover:bg-primary/90",
        )}
        disabled={pending}
        onClick={() => toggle("favorite")}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Heart className="h-4 w-4" />
        )}
        Favorite
      </Button>
      <Button
        type="button"
        className={cn(
          "h-11 gap-2 bg-transparent border border-border text-foreground",
          isInReadingList &&
            "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        )}
        disabled={pending}
        onClick={() => toggle("reading_list")}
      >
        <Bookmark
          className={cn("h-4 w-4", isInReadingList && "fill-current")}
        />
        Save
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 gap-2 rounded-xl"
        onClick={() => {
          navigator
            .share?.({
              title: book.title,
              text: book.description || undefined,
              url: window.location.href,
            })
            .catch(() => {});
        }}
      >
        <Share2 className="h-4 w-4" />
        Share
      </Button>
    </div>
  );
}
