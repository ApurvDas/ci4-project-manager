"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import type { Category, Tag, TagGroup } from "@/lib/types";
import { PREP_BUCKETS } from "@/lib/search";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  categories: Category[];
  groupedTags: Record<TagGroup, Tag[]>;
}

const GROUP_ORDER: TagGroup[] = ["Diet", "Meal Type", "Cuisine"];

/**
 * URL-driven filter controls. Every change rewrites the query string, which
 * re-renders the server list; the client <FlipGrid> then animates cards to
 * their new positions. Debounces the search box so typing doesn't thrash.
 */
export function FilterPanel({ categories, groupedTags }: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);

  const selectedTags = React.useMemo(() => {
    const raw = searchParams.get("tags");
    return new Set(raw ? raw.split(",").filter(Boolean) : []);
  }, [searchParams]);

  const category = searchParams.get("category") ?? "";
  const maxPrep = searchParams.get("maxPrep") ?? "";
  const q = searchParams.get("q") ?? "";

  const commit = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page"); // any filter change returns to page 1
      const query = params.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [router, pathname, searchParams],
  );

  // Debounced free-text search. Sync the draft to an external q change by
  // adjusting state during render (React's recommended alternative to an
  // effect), so back/forward navigation updates the box.
  const [draft, setDraft] = React.useState(q);
  const [syncedQ, setSyncedQ] = React.useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setDraft(q);
  }
  React.useEffect(() => {
    if (draft === q) return;
    const id = window.setTimeout(() => {
      commit((p) => {
        if (draft) p.set("q", draft);
        else p.delete("q");
      });
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const toggleTag = (slug: string) =>
    commit((p) => {
      const next = new Set(selectedTags);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      if (next.size) p.set("tags", [...next].join(","));
      else p.delete("tags");
    });

  const setCategory = (slug: string) =>
    commit((p) => {
      if (slug) p.set("category", slug);
      else p.delete("category");
    });

  const setMaxPrep = (value: string) =>
    commit((p) => {
      if (value) p.set("maxPrep", value);
      else p.delete("maxPrep");
    });

  const activeCount =
    (category ? 1 : 0) + (maxPrep ? 1 : 0) + selectedTags.size + (q ? 1 : 0);

  const clearAll = () =>
    startTransition(() => router.push(pathname, { scroll: false }));

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search recipes…"
            className="pl-9"
            aria-label="Search recipes"
          />
        </div>
        <Button
          variant="outline"
          size="md"
          className="lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <SlidersHorizontal className="size-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      <div className={cn("space-y-6", open ? "block" : "hidden lg:block")}>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" /> Clear all ({activeCount})
          </button>
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Category</legend>
          <div className="flex flex-col gap-1">
            <FilterChip
              active={!category}
              onClick={() => setCategory("")}
              label="All categories"
            />
            {categories.map((c) => (
              <FilterChip
                key={c.id}
                active={category === c.slug}
                onClick={() => setCategory(c.slug)}
                label={c.name}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Prep time</legend>
          <div className="flex flex-col gap-1">
            <FilterChip
              active={!maxPrep}
              onClick={() => setMaxPrep("")}
              label="Any time"
            />
            {PREP_BUCKETS.map((b) => (
              <FilterChip
                key={b.maxPrep}
                active={maxPrep === String(b.maxPrep)}
                onClick={() => setMaxPrep(String(b.maxPrep))}
                label={b.label}
              />
            ))}
          </div>
        </fieldset>

        {GROUP_ORDER.map((group) => (
          <fieldset key={group}>
            <legend className="mb-2 text-sm font-semibold">{group}</legend>
            <div className="flex flex-col gap-2">
              {groupedTags[group].map((tag) => (
                <Checkbox
                  key={tag.id}
                  checked={selectedTags.has(tag.slug)}
                  onChange={() => toggleTag(tag.slug)}
                  label={tag.name}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-3 py-1.5 text-left text-sm transition-[transform,background-color,color] duration-150 ease-snappy motion-safe:active:scale-[0.98]",
        active
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
