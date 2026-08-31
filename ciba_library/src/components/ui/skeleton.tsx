import { cn } from "@/lib/utils";

/** CSS-driven shimmer (see .ciba-skeleton in globals.css). No JS scope needed. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("ciba-skeleton rounded-md", className)} {...props} />
  );
}
