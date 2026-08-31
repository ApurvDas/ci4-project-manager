"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageCount: number;
}

/** Page controls that preserve the active filters in the query string. */
export function Pagination({ page, pageCount }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pageCount <= 1) return null;

  const go = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete("page");
    else params.set("page", String(target));
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <nav
      className="mt-10 flex items-center justify-center gap-2"
      aria-label="Pagination"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => go(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft className="size-4" /> Prev
      </Button>
      <span className="px-3 text-sm text-muted-foreground">
        Page <span className="font-medium text-foreground">{page}</span> of{" "}
        {pageCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => go(page + 1)}
        disabled={page >= pageCount}
      >
        Next <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
