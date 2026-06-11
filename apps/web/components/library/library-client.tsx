"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bookmark,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  Heart,
  Library,
  ListPlus,
  Loader2,
  LogIn,
  MoreVertical,
  Play,
  Search,
  Share2,
  Sparkles,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import {
  deleteUserBook,
  getFeaturedPublicBooks,
  searchPublicBooks,
  toggleBookList,
  type BookListType,
  type BookSummary,
  type LibraryCategory,
} from "@/lib/actions/library";
import { formatReadingDuration } from "@/lib/library-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { UploadBookDialog } from "../upload/upload-book-dialog";
import { cn } from "@/lib/utils";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";
import {
  MarkdownDescription,
  ReviewSummary,
} from "@/components/library/book-metadata";

export type LibraryViewMode =
  | "public"
  | "my-books"
  | "favorites"
  | "reading-list";

function primaryTag(book: BookSummary) {
  return book.tags[0] || (book.is_public ? "Public" : "Private");
}

function sourceLabel(source?: string | null) {
  if (!source) return "Glintpage";
  return source
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function CoverPlaceholder({ book }: { book: BookSummary }) {
  const colors = [
    "from-emerald-800 to-emerald-500",
    "from-indigo-900 to-violet-600",
    "from-amber-800 to-yellow-600",
    "from-rose-900 to-orange-600",
    "from-sky-900 to-cyan-600",
  ];
  const color = colors[(book.title.charCodeAt(0) || 0) % colors.length];
  const initials = book.title
    .split(/\s+/)
    .slice(0, 3)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`flex h-full w-full flex-col justify-end bg-gradient-to-br ${color} p-3 text-white`}
    >
      <span className="mb-auto h-5 w-5 rounded-full bg-white/10" />
      <span className="text-[10px] font-semibold uppercase opacity-70">
        {book.author?.split(" ").at(-1) || "Glintpage"}
      </span>
      <span className="text-sm font-bold leading-none">{initials}</span>
    </div>
  );
}

function BookCover({
  book,
  className = "",
}: {
  book: BookSummary;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-muted ${className}`}
    >
      {book.cover_url ? (
        <Image
          src={book.cover_url}
          alt={book.title}
          width={400}
          height={700}
          sizes="(max-width: 768px) 120px, 180px"
          className="object-cover"
          crossOrigin="anonymous"
        />
      ) : (
        <CoverPlaceholder book={book} />
      )}
    </div>
  );
}

function ListToggle({
  book,
  type,
  isAuthenticated,
  onChanged,
  className,
}: {
  book: BookSummary;
  type: BookListType;
  isAuthenticated: boolean;
  onChanged: (bookId: string, type: BookListType, active: boolean) => void;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const activeFromBook =
    type === "favorite"
      ? Boolean(book.is_favorite)
      : Boolean(book.is_in_reading_list);
  const [optimisticActive, setOptimisticActive] = useState(activeFromBook);
  const Icon = type === "favorite" ? Heart : Bookmark;

  useEffect(() => {
    setOptimisticActive(activeFromBook);
  }, [activeFromBook]);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={pending}
      title={
        isAuthenticated
          ? optimisticActive
            ? "Remove"
            : "Save"
          : "Log in to save books"
      }
      className={cn(
        "size-9 shrink-0 rounded-xl",
        optimisticActive
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground"
          : "bg-background/70",
        className,
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isAuthenticated) {
          window.location.href = "/auth/login";
          return;
        }
        const previous = optimisticActive;
        const next = !previous;
        setOptimisticActive(next);
        onChanged(book.id, type, next);
        startTransition(async () => {
          const result = await toggleBookList(book.id, type);
          if (typeof result.active !== "boolean") {
            setOptimisticActive(previous);
            onChanged(book.id, type, previous);
            toast.error(result.error || "Could not save this book.");
            return;
          }
          if (result.active !== next) {
            setOptimisticActive(result.active);
            onChanged(book.id, type, result.active);
          }
        });
      }}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className={cn("h-4 w-4", optimisticActive)} />
      )}
    </Button>
  );
}

function ReadNowButton({
  book,
  className = "",
  size,
}: {
  book: BookSummary;
  className?: string;
  size?:
    | "default"
    | "xs"
    | "sm"
    | "lg"
    | "icon"
    | "icon-xs"
    | "icon-sm"
    | "icon-lg"
    | null
    | undefined;
}) {
  const href = book.status === "completed" ? `/read/${book.id}` : "/library";
  return (
    <Button
      asChild
      disabled={book.status !== "completed"}
      className={` ${className}`}
      size={size}
    >
      <Link href={href}>
        <Play className="h-4 w-4" />
        Read now
      </Link>
    </Button>
  );
}

function VerticalBookCard({
  book,
  isAuthenticated,
  onListChanged,
}: {
  book: BookSummary;
  isAuthenticated: boolean;
  onListChanged: (bookId: string, type: BookListType, active: boolean) => void;
}) {
  const detailsHref = book.is_public ? `/books/${book.id}` : `/read/${book.id}`;

  return (
    <div className="group w-full h-full rounded-2xl flex flex-col justify-between border bg-card p-2.5 transition hover:-translate-y-0.5 hover:bg-muted/30 min-[380px]:p-3">
      <Link href={detailsHref} className="block">
        <div className="relative aspect-square rounded-xl bg-foreground/5 p-3 min-[380px]:p-4">
          <BookCover
            book={book}
            className="mx-auto h-full w-[68%] min-[380px]:w-[70%]"
          />
        </div>
        <div className="mt-3 min-h-16 min-w-0">
          <h3 className="line-clamp-2 truncate text-[13px] font-semibold leading-tight min-[380px]:text-sm">
            {book.title}
          </h3>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {book.author || "Unknown author"}
          </p>
          <ReviewSummary book={book} className="mt-2" />
        </div>
      </Link>
      <div className="mt-3 flex items-center justify-between gap-2">
        <ReadNowButton
          book={book}
          className="h-7 md:h-9 min-w-0 flex-1 rounded-lg text-xs"
        />
        <ListToggle
          book={book}
          type="favorite"
          isAuthenticated={isAuthenticated}
          onChanged={onListChanged}
          className="h-7 w-7 md:h-9 md:w-9"
        />
      </div>
    </div>
  );
}

function FeaturedBookCard({
  book,
  isAuthenticated,
  onListChanged,
}: {
  book: BookSummary;
  isAuthenticated: boolean;
  onListChanged: (bookId: string, type: BookListType, active: boolean) => void;
}) {
  return (
    <section className="relative rounded-2xl border bg-accent/40 p-4 dark:bg-card max-[360px]:p-3 md:p-6">
      <div className="absolute right-4 top-4 z-10 max-[360px]:right-3 max-[360px]:top-3 md:right-5 md:top-5">
        <ListToggle
          book={book}
          type="reading_list"
          isAuthenticated={isAuthenticated}
          onChanged={onListChanged}
        />
      </div>
      <div className="grid gap-5 grid-cols-1">
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3 pr-10 min-[380px]:gap-4 min-[380px]:pr-12 md:pr-14">
          <Link href={`/books/${book.id}`} className="min-w-0">
            <BookCover
              book={book}
              className="h-36 w-24 min-[380px]:h-40 min-[380px]:w-28 md:h-44 md:w-32"
            />
          </Link>
          <div className="mt-2 min-w-0">
            <h2 className="line-clamp-2 text-base font-bold tracking-tight min-[380px]:text-xl md:text-2xl">
              {book.title}
            </h2>

            <p className="truncate text-xs font-medium text-muted-foreground md:text-sm">
              {book.author || "Unknown author"}
            </p>
            <ReviewSummary book={book} className="mt-2" />
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className="max-w-full truncate text-[10px] md:text-sm">
                {primaryTag(book)}
              </Badge>
              <Badge className="text-[10px] md:text-sm" variant="secondary">
                Featured
              </Badge>
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <MarkdownDescription className="mt-3 line-clamp-3 max-w-prose text-xs leading-4 md:mt-4 md:text-sm md:leading-6">
            {book.description ||
              "A public-domain title ready to read in Glintpage's focused reader."}
          </MarkdownDescription>
          <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Metric
              label="Pages"
              value={book.page_count ? String(book.page_count) : "Ready"}
              icon={BookOpen}
            />
            <Metric
              label="Total read time"
              value={formatReadingDuration(
                book.total_read_seconds,
                "No reads yet",
              )}
              icon={Clock}
              className="max-sm:border-none"
            />
            <Metric
              label="Your reading time"
              value={
                isAuthenticated
                  ? formatReadingDuration(book.user_read_seconds, "0 min")
                  : "Log in to track"
              }
              icon={Library}
            />
            <Metric
              label="Source"
              value={sourceLabel(book.source_provider)}
              icon={Sparkles}
              className="border-none"
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 min-[380px]:flex-row">
            <ReadNowButton book={book} className="rounded-xl" />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                navigator
                  .share?.({
                    title: book.title,
                    url: `${window.location.origin}/books/${book.id}`,
                  })
                  .catch(() => {});
              }}
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("border-r p-1 md:p-3", className)}>
      <p className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="mt-1 text-xs sm:text-sm font-semibold">{value}</p>
    </div>
  );
}

function BookRail({
  title,
  books,
  isAuthenticated,
  onListChanged,
}: {
  title: string;
  books: BookSummary[];
  isAuthenticated: boolean;
  onListChanged: (bookId: string, type: BookListType, active: boolean) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!api) return;

    const update = () => {
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    update();
    api.on("reInit", update);
    api.on("select", update);

    return () => {
      api.off("reInit", update);
      api.off("select", update);
    };
  }, [api]);

  if (!books.length) return null;

  return (
    <section className="space-y-3">
      <div className="flex w-full items-center justify-between gap-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            disabled={!canScrollPrev}
            onClick={() => api?.scrollPrev()}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Previous books</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            disabled={!canScrollNext}
            onClick={() => api?.scrollNext()}
          >
            <ArrowRight className="h-4 w-4" />
            <span className="sr-only">Next books</span>
          </Button>
        </div>
      </div>
      <Carousel
        opts={{ align: "start", dragFree: true }}
        setApi={setApi}
        className="px-1"
      >
        <CarouselContent>
          {books.map((book) => (
            <CarouselItem
              key={book.id}
              className="basis-[65%] min-[420px]:basis-1/2 sm:basis-1/3 lg:basis-1/4 xl:basis-1/5"
            >
              <VerticalBookCard
                book={book}
                isAuthenticated={isAuthenticated}
                onListChanged={onListChanged}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}

function FeaturedBooksCarousel({
  books,
  isAuthenticated,
  onListChanged,
}: {
  books: BookSummary[];
  isAuthenticated: boolean;
  onListChanged: (bookId: string, type: BookListType, active: boolean) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!api || paused || books.length <= 1) return;
    const timer = window.setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
      else api.scrollTo(0);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [api, books.length, paused]);

  if (!books.length) return null;

  return (
    <section
      className="space-y-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="flex w-full items-center justify-between gap-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Featured books
        </h2>
      </div>
      <Carousel
        opts={{ align: "start", loop: books.length > 2 }}
        setApi={setApi}
      >
        <CarouselContent>
          {books.map((book) => (
            <CarouselItem key={book.id} className="basis-full md:basis-1/2">
              <FeaturedBookCard
                book={book}
                isAuthenticated={isAuthenticated}
                onListChanged={onListChanged}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}

function HorizontalBookRow({
  book,
  isAuthenticated,
  expanded,
  onToggleExpanded,
  onListChanged,
  onDeleted,
  allowDelete = false,
}: {
  book: BookSummary;
  isAuthenticated: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onListChanged: (bookId: string, type: BookListType, active: boolean) => void;
  onDeleted?: (bookId: string) => void;
  allowDelete?: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, startDelete] = useTransition();

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteUserBook(book.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      onDeleted?.(book.id);
      setDeleteOpen(false);
      toast.success("Book deleted");
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-accent/60 dark:bg-card">
      <div className="flex w-full items-center gap-2 p-3 transition hover:bg-muted/40">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left min-[380px]:gap-4"
        >
          <BookCover
            book={book}
            className="h-14 w-10 shrink-0 min-[380px]:h-16 min-[380px]:w-12"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold">{book.title}</h3>
            <p className="truncate text-xs text-muted-foreground">
              {book.author || "Unknown author"}
            </p>
            <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              {book.progress_percentage != null ? (
                <span className="shrink-0">
                  {Math.round(book.progress_percentage)}% read
                </span>
              ) : null}
              <Badge
                variant="outline"
                className="h-5 max-w-full truncate rounded-full px-2 text-[10px]"
              >
                {primaryTag(book)}
              </Badge>
            </div>
          </div>
          {expanded ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          )}
        </button>
        {allowDelete && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete book
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          expanded
            ? "max-h-[32rem] border-t p-3 md:max-h-96 md:p-4"
            : "max-h-0",
        )}
      >
        <MarkdownDescription className="line-clamp-3 text-sm leading-6">
          {book.description || "No description available yet."}
        </MarkdownDescription>
        <div className="mt-4 grid grid-cols-2 gap-2 min-[380px]:grid-cols-3">
          <Metric
            label="Pages"
            value={book.page_count ? String(book.page_count) : "Ready"}
            icon={BookOpen}
          />
          <Metric
            label="Total read time"
            value={formatReadingDuration(
              book.total_read_seconds,
              "No reads yet",
            )}
            icon={Clock}
          />
          <Metric
            label="Your reading time"
            value={
              isAuthenticated
                ? formatReadingDuration(book.user_read_seconds, "0 min")
                : "Log in to track"
            }
            icon={Library}
            className="border-none"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <ReadNowButton book={book} className="min-w-0 flex-1" />
          <ListToggle
            book={book}
            type="favorite"
            isAuthenticated={isAuthenticated}
            onChanged={onListChanged}
          />
          <ListToggle
            book={book}
            type="reading_list"
            isAuthenticated={isAuthenticated}
            onChanged={onListChanged}
          />
        </div>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this book?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This permanently deletes "${book.title}", its uploaded file, reader pages, translations, audio, and reading progress. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={handleDelete}
            >
              {deletePending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Delete book
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border bg-card px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function CategoryCardGrid({ categories }: { categories: LibraryCategory[] }) {
  const visible = categories
    .filter((category) => category.count > 0)
    .slice(0, 8);
  if (!visible.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Curated categories
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((category) => (
          <Link
            key={category.slug}
            href={`/library/category/${category.slug}`}
            className="group rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:bg-muted/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{category.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {category.description ||
                    `${category.count} ${
                      category.count === 1 ? "book" : "books"
                    } to explore.`}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
            </div>
            <div className="mt-5 flex -space-x-3">
              {category.sampleBooks.slice(0, 4).map((book) => (
                <BookCover
                  key={book.id}
                  book={book}
                  className="h-20 w-14 border-2 border-card"
                />
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function LibraryTabSkeleton({
  variant,
}: {
  variant: "discover" | "rows" | "categories";
}) {
  if (variant === "rows") {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 rounded-xl border bg-card p-3"
          >
            <Skeleton className="h-16 w-12 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === "categories") {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-2xl border bg-card p-5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-2/3" />
            <Skeleton className="mt-2 h-4 w-24" />
            <div className="mt-5 flex -space-x-3">
              {Array.from({ length: 3 }).map((__, coverIndex) => (
                <Skeleton
                  key={coverIndex}
                  className="h-20 w-14 rounded-lg border-2 border-card"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-72 rounded-2xl" />
        ))}
      </div>
      {Array.from({ length: 2 }).map((_, railIndex) => (
        <section key={railIndex} className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((__, index) => (
              <Skeleton key={index} className="h-72 rounded-2xl" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function LibraryClient({
  mode = "public",
  withTopOffset = true,
  initialMyBooks,
  initialPublicBooks,
  initialFeaturedBooks,
  initialFavorites,
  initialReadingList,
  initialCategories,
  initialTab = "discover",
  processingBookId,
  isAuthenticated = false,
}: {
  mode?: LibraryViewMode;
  withTopOffset?: boolean;
  initialMyBooks: BookSummary[];
  initialPublicBooks: BookSummary[];
  initialFeaturedBooks: BookSummary[];
  initialFavorites: BookSummary[];
  initialReadingList: BookSummary[];
  initialCategories: LibraryCategory[];
  initialTab?:
    | "discover"
    | "my-books"
    | "favorites"
    | "reading-list"
    | "categories";
  processingBookId?: string;
  isAuthenticated?: boolean;
}) {
  const [myBooks, setMyBooks] = useState(initialMyBooks);
  const [publicBooks, setPublicBooks] = useState(initialPublicBooks);
  const [featuredBooks, setFeaturedBooks] = useState(initialFeaturedBooks);
  const [favorites, setFavorites] = useState(initialFavorites);
  const [readingList, setReadingList] = useState(initialReadingList);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(
    mode === "public" ? initialTab : mode,
  );
  const [tabLoading, setTabLoading] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const tabLoadingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const hasProcessing = myBooks.some(
    (book) => book.status === "pending" || book.status === "processing",
  );

  useEffect(() => {
    return () => clearTimeout(tabLoadingTimeout.current);
  }, []);

  const syncBookState = useCallback(
    (bookId: string, type: BookListType, active: boolean) => {
      const apply = (book: BookSummary) =>
        book.id === bookId
          ? {
              ...book,
              is_favorite: type === "favorite" ? active : book.is_favorite,
              is_in_reading_list:
                type === "reading_list" ? active : book.is_in_reading_list,
            }
          : book;
      const sourceBook = [
        ...publicBooks,
        ...featuredBooks,
        ...myBooks,
        ...favorites,
        ...readingList,
      ].find((book) => book.id === bookId);
      const updatedSource = sourceBook ? apply(sourceBook) : null;

      setPublicBooks((books) => books.map(apply));
      setFeaturedBooks((books) => books.map(apply));
      setMyBooks((books) => books.map(apply));
      setFavorites((books) =>
        type === "favorite" && !active
          ? books.filter((book) => book.id !== bookId)
          : type === "favorite" &&
              active &&
              updatedSource &&
              !books.some((book) => book.id === bookId)
            ? [updatedSource, ...books]
            : books.map(apply),
      );
      setReadingList((books) =>
        type === "reading_list" && !active
          ? books.filter((book) => book.id !== bookId)
          : type === "reading_list" &&
              active &&
              updatedSource &&
              !books.some((book) => book.id === bookId)
            ? [updatedSource, ...books]
            : books.map(apply),
      );
    },
    [favorites, featuredBooks, myBooks, publicBooks, readingList],
  );

  const removeBookState = useCallback((bookId: string) => {
    setMyBooks((books) => books.filter((book) => book.id !== bookId));
    setPublicBooks((books) => books.filter((book) => book.id !== bookId));
    setFeaturedBooks((books) => books.filter((book) => book.id !== bookId));
    setFavorites((books) => books.filter((book) => book.id !== bookId));
    setReadingList((books) => books.filter((book) => book.id !== bookId));
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      startSearch(async () => {
        const results = await searchPublicBooks(query);
        setPublicBooks(results);
        if (!query.trim()) setFeaturedBooks(await getFeaturedPublicBooks());
      });
    }, 300);
  }, []);

  const handleTabChange = useCallback(
    (value: string) => {
      const nextTab = value as typeof activeTab;
      if (nextTab === activeTab) return;
      clearTimeout(tabLoadingTimeout.current);
      setActiveTab(nextTab);
      setTabLoading(true);
      tabLoadingTimeout.current = setTimeout(() => setTabLoading(false), 180);
    },
    [activeTab],
  );

  const trendingBooks = useMemo(
    () =>
      [...publicBooks]
        .sort((a, b) => b.total_read_seconds - a.total_read_seconds)
        .slice(0, 12),
    [publicBooks],
  );
  const recentBooks = useMemo(() => publicBooks.slice(0, 12), [publicBooks]);
  const accountBooks =
    mode === "my-books"
      ? myBooks
      : mode === "favorites"
        ? favorites
        : mode === "reading-list"
          ? readingList
          : [];

  const title =
    mode === "my-books"
      ? "My books"
      : mode === "favorites"
        ? "Favorites"
        : mode === "reading-list"
          ? "Reading list"
          : "Library";
  const description =
    mode === "my-books"
      ? "Upload private PDFs and EPUBs, track processing, and continue reading."
      : mode === "favorites"
        ? "Books you marked as favorites."
        : mode === "reading-list"
          ? "Books saved for later."
          : "Discover public-domain books and curated categories.";

  return (
    <div
      className={cn(
        "bg-background",
        mode === "public" &&
          withTopOffset &&
          "min-h-[calc(100vh-64px)] pt-16",
      )}
    >
      <MaxWidthWrapper as="main" className=" py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          </div>
          {mode === "my-books" && isAuthenticated ? (
            <UploadBookDialog />
          ) : mode === "public" && !isAuthenticated ? (
            <Button asChild variant="outline" className="gap-2">
              <Link href="/auth/login">
                <LogIn className="h-4 w-4" />
                Log in
              </Link>
            </Button>
          ) : null}
        </div>

        {mode === "public" ? (
          <>
            <div className="relative mb-5">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search books, authors, genres..."
                value={searchQuery}
                onChange={(event) => handleSearch(event.target.value)}
                className="h-12 rounded-xl pl-10 pr-10"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>

            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="space-y-6"
            >
              <div className="max-sm:overflow-x-auto overflow-y-hidden scrollbar-hide">
                <TabsList className="h-auto flex flex-nowrap w-max justify-start gap-2 bg-transparent p-0">
                  {[
                    ["discover", "Discover"],
                    ["categories", "Categories"],
                  ].map(([value, label]) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="shrink-0 border bg-background px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground cursor-pointer"
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
          </div>

          <TabsContent value="discover" className="space-y-8">
            {tabLoading && activeTab === "discover" ? (
              <LibraryTabSkeleton variant="discover" />
            ) : featuredBooks.length ? (
              <FeaturedBooksCarousel
                books={featuredBooks}
                isAuthenticated={isAuthenticated}
                onListChanged={syncBookState}
              />
            ) : (
              <EmptyState
                icon={Library}
                title="Public library is empty"
                body="Imported public books will appear here after processing completes."
              />
            )}

            <BookRail
              title="Trending now"
              books={trendingBooks}
              isAuthenticated={isAuthenticated}
              onListChanged={syncBookState}
            />

            <BookRail
              title="Recently added"
              books={recentBooks}
              isAuthenticated={isAuthenticated}
              onListChanged={syncBookState}
            />
            <CategoryCardGrid categories={initialCategories} />
          </TabsContent>

          <TabsContent value="my-books" className="space-y-4">
            {tabLoading && activeTab === "my-books" ? (
              <LibraryTabSkeleton variant="rows" />
            ) : !isAuthenticated ? (
              <EmptyState
                icon={LogIn}
                title="Log in to upload books"
                body="Your private books and saved reading progress live in your account."
                action={
                  <Button asChild>
                    <Link href="/auth/login">Log in</Link>
                  </Button>
                }
              />
            ) : myBooks.length === 0 ? (
              <EmptyState
                icon={Upload}
                title="No books yet"
                body="Upload a PDF or EPUB to start reading in Glintpage."
                action={
                  <UploadBookDialog
                    triggerLabel="Upload a book"
                    triggerVariant="outline"
                  />
                }
              />
            ) : (
              <>
                {(hasProcessing || processingBookId) && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    Your book is queued for processing. This page refreshes
                    automatically while extraction runs.
                  </div>
                )}
                {myBooks.map((book) => (
                  <HorizontalBookRow
                    key={book.id}
                    book={book}
                    isAuthenticated={isAuthenticated}
                    expanded={
                      expandedBookId === book.id || processingBookId === book.id
                    }
                    onToggleExpanded={() =>
                      setExpandedBookId((current) =>
                        current === book.id ? null : book.id,
                      )
                    }
                    onListChanged={syncBookState}
                    onDeleted={removeBookState}
                    allowDelete={!book.is_public}
                  />
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="favorites" className="space-y-4">
            {tabLoading && activeTab === "favorites" ? (
              <LibraryTabSkeleton variant="rows" />
            ) : !isAuthenticated ? (
              <EmptyState
                icon={Heart}
                title="Log in to save favorites"
                body="Favorite books stay synced across your devices."
                action={
                  <Button asChild>
                    <Link href="/auth/login">Log in</Link>
                  </Button>
                }
              />
            ) : favorites.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="No favorites yet"
                body="Tap the heart on any book to save it here."
              />
            ) : (
              favorites.map((book) => (
                <HorizontalBookRow
                  key={book.id}
                  book={book}
                  isAuthenticated={isAuthenticated}
                  expanded={expandedBookId === book.id}
                  onToggleExpanded={() =>
                    setExpandedBookId((current) =>
                      current === book.id ? null : book.id,
                    )
                  }
                  onListChanged={syncBookState}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="reading-list" className="space-y-4">
            {tabLoading && activeTab === "reading-list" ? (
              <LibraryTabSkeleton variant="rows" />
            ) : !isAuthenticated ? (
              <EmptyState
                icon={ListPlus}
                title="Log in to build a reading list"
                body="Save public books for later and come back when you are ready."
                action={
                  <Button asChild>
                    <Link href="/auth/login">Log in</Link>
                  </Button>
                }
              />
            ) : readingList.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                title="Reading list is empty"
                body="Use the bookmark action on a book to add it to your list."
              />
            ) : (
              readingList.map((book) => (
                <HorizontalBookRow
                  key={book.id}
                  book={book}
                  isAuthenticated={isAuthenticated}
                  expanded={expandedBookId === book.id}
                  onToggleExpanded={() =>
                    setExpandedBookId((current) =>
                      current === book.id ? null : book.id,
                    )
                  }
                  onListChanged={syncBookState}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="categories">
            {tabLoading && activeTab === "categories" ? (
              <LibraryTabSkeleton variant="categories" />
            ) : initialCategories.length === 0 ? (
              <EmptyState
                icon={Tag}
                title="No categories yet"
                body="Curated admin categories will appear here."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {initialCategories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/library/category/${category.slug}`}
                    className="rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                          Category
                        </p>
                        <h2 className="mt-1 text-xl font-semibold">
                          {category.name}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {category.count}{" "}
                          {category.count === 1 ? "book" : "books"}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="mt-5 flex -space-x-3">
                      {category.sampleBooks.slice(0, 4).map((book) => (
                        <BookCover
                          key={book.id}
                          book={book}
                          className="h-20 w-14 border-2 border-card"
                        />
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>
            </Tabs>
          </>
        ) : !isAuthenticated ? (
          <EmptyState
            icon={LogIn}
            title="Log in required"
            body="Your personal book lists live in your account."
            action={
              <Button asChild>
                <Link href="/auth/login">Log in</Link>
              </Button>
            }
          />
        ) : accountBooks.length === 0 ? (
          <EmptyState
            icon={
              mode === "my-books"
                ? Upload
                : mode === "favorites"
                  ? Heart
                  : Bookmark
            }
            title={
              mode === "my-books"
                ? "No books yet"
                : mode === "favorites"
                  ? "No favorites yet"
                  : "Reading list is empty"
            }
            body={
              mode === "my-books"
                ? "Upload a PDF or EPUB to start reading in Glintpage."
                : mode === "favorites"
                  ? "Tap the heart on any book to save it here."
                  : "Use the bookmark action on a book to add it to your list."
            }
            action={
              mode === "my-books" ? (
                <UploadBookDialog
                  triggerLabel="Upload a book"
                  triggerVariant="outline"
                />
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {mode === "my-books" && (hasProcessing || processingBookId) && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                Your book is queued for processing. This page refreshes
                automatically while extraction runs.
              </div>
            )}
            {accountBooks.map((book) => (
              <HorizontalBookRow
                key={book.id}
                book={book}
                isAuthenticated={isAuthenticated}
                expanded={
                  expandedBookId === book.id || processingBookId === book.id
                }
                onToggleExpanded={() =>
                  setExpandedBookId((current) =>
                    current === book.id ? null : book.id,
                  )
                }
                onListChanged={syncBookState}
                onDeleted={removeBookState}
                allowDelete={mode === "my-books" && !book.is_public}
              />
            ))}
          </div>
        )}
      </MaxWidthWrapper>
    </div>
  );
}
