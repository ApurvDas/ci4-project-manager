import type { Metadata } from "next";
import Link from "next/link";
import { PlusCircle, Users } from "lucide-react";
import { getCurrentUser, getFeed, getShoppingList } from "@/data/users";
import { getRecipesByAuthor } from "@/data/recipes";
import { RecipeGrid } from "@/components/recipe/RecipeGrid";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [feed, myRecipes, shoppingList] = await Promise.all([
    getFeed(),
    user ? getRecipesByAuthor(user.username) : Promise.resolve([]),
    getShoppingList(),
  ]);

  const stats = [
    { label: "Your recipes", value: myRecipes.length },
    { label: "Shopping items", value: shoppingList.length },
    { label: "In your feed", value: feed.length },
  ];

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back{user ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s cooking across the people you follow.
          </p>
        </div>
        <Button asChild>
          <Link href="/recipes/new">
            <PlusCircle className="size-4" /> New recipe
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="py-5 text-center">
              <div className="text-3xl font-semibold tabular-nums">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {s.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Users className="size-5 text-primary" />
          From cooks you follow
        </h2>
        {feed.length > 0 ? (
          <RecipeGrid recipes={feed} showAuthor />
        ) : (
          <EmptyState
            icon={Users}
            title="Your feed is quiet"
            description="Follow other cooks to see their newest recipes here."
            action={
              <Button asChild variant="outline">
                <Link href="/recipes">Discover recipes</Link>
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
