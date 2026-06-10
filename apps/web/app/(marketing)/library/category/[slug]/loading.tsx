import { Skeleton } from "@/components/ui/skeleton";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";

export default function CategoryLoading() {
  return (
    <main className="min-h-screen bg-background pt-16">
      <MaxWidthWrapper className="py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-5 w-72" />
          </div>
          <Skeleton className="h-10 w-32 rounded-3xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-40 rounded-2xl" />
          ))}
        </div>
      </MaxWidthWrapper>
    </main>
  );
}
