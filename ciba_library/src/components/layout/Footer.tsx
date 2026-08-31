import Link from "next/link";
import { ChefHat } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <ChefHat className="size-4 text-primary" />
          Ciba Library
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/recipes" className="hover:text-foreground">
            Browse
          </Link>
          <Link href="/recipes/new" className="hover:text-foreground">
            Submit a recipe
          </Link>
          <Link href="/styleguide" className="hover:text-foreground">
            Motion styleguide
          </Link>
        </nav>
        <p>© {new Date().getFullYear()} Ciba Library</p>
      </div>
    </footer>
  );
}
