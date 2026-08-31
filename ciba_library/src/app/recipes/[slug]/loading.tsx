import { Skeleton } from "@/components/ui/skeleton";

export default function RecipeLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div className="order-2 space-y-4 md:order-1">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-16 w-56" />
        </div>
        <Skeleton className="order-1 aspect-[4/3] rounded-xl md:order-2" />
      </div>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <Skeleton className="h-80 rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
