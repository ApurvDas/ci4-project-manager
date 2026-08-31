"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { RecipeSort } from "@/lib/types";

const OPTIONS: { value: RecipeSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "top", label: "Top rated" },
  { value: "discussed", label: "Most discussed" },
];

/** Sort dropdown that writes `sort` into the query string. */
export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (searchParams.get("sort") as RecipeSort) ?? "newest";

  const onChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "newest") params.delete("sort");
    else params.set("sort", value);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Sort
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Sort recipes"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
