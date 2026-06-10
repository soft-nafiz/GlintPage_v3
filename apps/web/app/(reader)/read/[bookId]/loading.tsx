import { Skeleton } from "@/components/ui/skeleton";

export default function ReaderLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-9 w-28 rounded-3xl" />
        </div>
      </div>
      <article className="mx-auto max-w-3xl px-6 py-12">
        <div className="space-y-5">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-10/12" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-5 w-11/12" />
          <Skeleton className="h-5 w-9/12" />
        </div>
      </article>
    </main>
  );
}
