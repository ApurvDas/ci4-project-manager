import Link from "next/link";
import { ChefHat, PlusCircle, Search, ShoppingBasket } from "lucide-react";
import { getCurrentUser, getShoppingListCount } from "@/data/users";
import { signOutAction } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Top navigation. Auth-aware: signed-in cooks get a submit link, their avatar,
 * a sign-out control, and a live count on the shopping-basket badge that the
 * add-to-list flight animation targets. Signed-out visitors get a sign-in CTA.
 */
export async function Navbar() {
  const [user, cartCount] = await Promise.all([
    getCurrentUser(),
    getShoppingListCount(),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <ChefHat className="size-5 text-primary" />
          <span>Ciba Library</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/recipes">Browse</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/styleguide">Motion</Link>
          </Button>
          {user && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search recipes"
            asChild
          >
            <Link href="/recipes">
              <Search />
            </Link>
          </Button>

          <Link
            href="/dashboard/shopping-list"
            aria-label="Shopping list"
            className="relative inline-flex size-10 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ShoppingBasket className="size-4" />
            <span
              id="cart-badge"
              className={`absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground ${
                cartCount > 0 ? "" : "hidden"
              }`}
            >
              {cartCount}
            </span>
          </Link>

          <ThemeToggle />

          {user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 hidden sm:inline-flex"
                asChild
              >
                <Link href="/recipes/new">
                  <PlusCircle className="size-4" /> Share
                </Link>
              </Button>
              <Link
                href={`/users/${user.username}`}
                aria-label="Your profile"
                className="ml-1 rounded-full ring-offset-background transition hover:ring-2 hover:ring-ring hover:ring-offset-2"
              >
                <Avatar name={user.name} image={user.image} className="size-8" />
              </Link>
              <form action={signOutAction}>
                <Button type="submit" variant="ghost" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Button size="sm" className="ml-1" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
