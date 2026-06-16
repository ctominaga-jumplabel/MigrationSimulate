import { cn } from "@/lib/cn";
import { HTMLAttributes } from "react";

export function Card({
  className,
  strong,
  ...props
}: HTMLAttributes<HTMLDivElement> & { strong?: boolean }) {
  return (
    <div
      className={cn(
        strong ? "glass-strong" : "glass",
        "rounded-2xl",
        className
      )}
      {...props}
    />
  );
}
