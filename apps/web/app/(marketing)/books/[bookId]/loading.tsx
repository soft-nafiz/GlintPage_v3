import { Skeleton } from "@/components/ui/skeleton";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";

export default function BookDetailsLoading() {
  return (
    <main className="min-h-screen bg-background pt-16">
      <MaxWidthWrapper className="max-w-6xl py-10">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <Skeleton className="aspect-[2/3] rounded-2xl" />
          <section className="min-w-0">
            <div className="mb-3 flex gap-2">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-12 w-3/4 max-w-3xl" />
            <Skeleton className="mt-3 h-6 w-48" />
            <div className="mt-6 space-y-3">
              <Skeleton className="h-5 w-full max-w-3xl" />
              <Skeleton className="h-5 w-11/12 max-w-3xl" />
              <Skeleton className="h-5 w-2/3 max-w-3xl" />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-2xl" />
              ))}
            </div>
            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <Skeleton className="h-11 flex-1 rounded-xl" />
              <Skeleton className="h-11 w-32 rounded-xl" />
              <Skeleton className="h-11 w-28 rounded-xl" />
            </div>
          </section>
        </div>
      </MaxWidthWrapper>
    </main>
  );
}
