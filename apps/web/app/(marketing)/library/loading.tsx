import { Skeleton } from "@/components/ui/skeleton";
import { MaxWidthWrapper } from "@/components/max-width-wrapper";

export default function LibraryLoading() {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-background pt-16">
      <MaxWidthWrapper className=" py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-80 max-w-[70vw]" />
          </div>
          <Skeleton className="h-10 w-32 rounded-3xl" />
        </div>
        <Skeleton className="mb-5 h-12 w-full rounded-xl" />
        <div className="mb-6 flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      </MaxWidthWrapper>
    </main>
  );
}
