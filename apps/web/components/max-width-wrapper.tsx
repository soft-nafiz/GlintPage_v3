import * as React from "react";
import { cn } from "@/lib/utils";

type MaxWidthWrapperProps = React.ComponentProps<"div"> & {
  as?: React.ElementType;
};

export function MaxWidthWrapper({
  as: Component = "div",
  className,
  ...props
}: MaxWidthWrapperProps) {
  return (
    <Component
      className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12", className)}
      {...props}
    />
  );
}
