"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function BookDetailsBackButton({
  fallbackHref,
}: {
  fallbackHref: string;
}) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      className="-ml-3 gap-2"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }

        router.push(fallbackHref);
      }}
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
}
