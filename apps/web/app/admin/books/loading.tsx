import { Skeleton } from "@/components/ui/skeleton";

export default function AdminBooksLoading() {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-80 max-w-[70vw]" />
          </div>
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-[36rem] rounded-2xl" />
        </div>
      </div>
    </main>
  );
}
