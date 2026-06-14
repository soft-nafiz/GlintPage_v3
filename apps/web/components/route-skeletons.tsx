import { MaxWidthWrapper } from "@/components/max-width-wrapper";
import { Skeleton } from "@/components/ui/skeleton";

export function MarketingRouteSkeleton() {
  return (
    <main className="min-h-screen bg-background pt-16">
      <MaxWidthWrapper className="py-10 md:py-14">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-5">
            <Skeleton className="h-5 w-32 rounded-full" />
            <Skeleton className="h-14 w-full max-w-2xl" />
            <Skeleton className="h-14 w-4/5 max-w-xl" />
            <div className="space-y-3 pt-2">
              <Skeleton className="h-5 w-full max-w-xl" />
              <Skeleton className="h-5 w-10/12 max-w-xl" />
            </div>
            <div className="flex gap-3 pt-3">
              <Skeleton className="h-11 w-36 rounded-xl" />
              <Skeleton className="h-11 w-32 rounded-xl" />
            </div>
          </div>
          <Skeleton className="aspect-[4/3] rounded-2xl" />
        </section>
        <section className="mt-12 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-44 rounded-2xl" />
          ))}
        </section>
      </MaxWidthWrapper>
    </main>
  );
}

export function DashboardOverviewSkeleton() {
  return (
    <div className="my-10 min-h-screen p-2 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <Skeleton className="h-64 rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export function DashboardLibrarySkeleton() {
  return (
    <div className="py-8 px-4">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80 max-w-[65vw]" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <Skeleton className="mb-5 h-12 w-full rounded-xl" />
      <div className="mb-6 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-28 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function BillingSkeleton() {
  return (
    <div className="py-10">
      <div className="mb-8 space-y-3 text-center">
        <Skeleton className="mx-auto h-10 w-56" />
        <Skeleton className="mx-auto h-5 w-96 max-w-[80vw]" />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-[34rem] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="mx-auto mt-10 max-w-4xl px-2 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-9 w-60" />
        <Skeleton className="h-5 w-96 max-w-[80vw]" />
      </div>
      <div className="space-y-6">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  );
}

export function MyBooksSkeleton() {
  return (
    <div className="py-8 px-4 mx-auto w-full">
      <div className="grid grid-cols-1 gap-6">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Skeleton key={i} className="w-full h-24" />
        ))}
      </div>
    </div>
  );
}
