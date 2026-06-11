import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-5">
        <div className="space-y-3 text-center">
          <Skeleton className="mx-auto h-10 w-44" />
          <Skeleton className="mx-auto h-4 w-72 max-w-[80vw]" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </main>
  );
}
