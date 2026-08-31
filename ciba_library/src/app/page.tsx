import Link from "next/link";
import { ArrowRight, Sparkles, Flame, Clock, Star } from "lucide-react";
import { getTopRecipes, getRecentRecipes } from "@/data/recipes";
import { getCategories } from "@/data/taxonomy";
import type { Recipe } from "@/lib/types";
import { SplitTextHeadline } from "@/components/motion/SplitTextHeadline";
import { Reveal } from "@/components/motion/Reveal";
import { HeroParallax } from "@/components/motion/HeroParallax";
import { HeroRamen } from "@/components/motion/HeroRamen";
import { RotatingBadge } from "@/components/motion/RotatingBadge";
import { FlipCard3D } from "@/components/motion/FlipCard3D";
import { RecipeGrid } from "@/components/recipe/RecipeGrid";
import { RecipeImage } from "@/components/recipe/RecipeImage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Reads live recipe data per request; don't prerender at build.
export const dynamic = "force-dynamic";

/** Front face of a top-pick flip card: cover, category, title. */
function TopPickFront({ recipe }: { recipe: Recipe }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[16/10] overflow-hidden">
        <RecipeImage
          title={recipe.title}
          imageUrl={recipe.imageUrl}
          hue={recipe.imageHue}
        />
        <Badge
          variant="default"
          className="absolute left-3 top-3 bg-background/85 backdrop-blur"
        >
          {recipe.category.name}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-2 p-4">
        <h3 className="font-display text-lg font-medium leading-snug tracking-tight">
          {recipe.title}
        </h3>
        <p className="text-xs text-muted-foreground">Hover to flip →</p>
      </div>
    </div>
  );
}

/** Back face: the quick facts, on terracotta. */
function TopPickBack({ recipe }: { recipe: Recipe }) {
  return (
    <div className="flex h-full flex-col justify-between rounded-xl border border-primary/40 bg-primary p-5 text-primary-foreground">
      <div>
        <h3 className="font-display text-xl font-medium leading-snug">
          {recipe.title}
        </h3>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Star className="size-4 fill-current" />
            <span className="font-medium">{recipe.avgRating.toFixed(1)}</span>
            <span className="opacity-80">({recipe.ratingCount} ratings)</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4" />
            <span>{recipe.prepTimeMins + recipe.cookTimeMins} min total</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {recipe.tags.slice(0, 3).map((t) => (
              <span
                key={t.id}
                className="rounded-full bg-primary-foreground/15 px-2 py-0.5 text-xs"
              >
                {t.name}
              </span>
            ))}
          </div>
        </dl>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-medium">
        View recipe <ArrowRight className="size-4" />
      </span>
    </div>
  );
}

export default async function HomePage() {
  const [top, recent, categories] = await Promise.all([
    getTopRecipes(3),
    getRecentRecipes(6),
    getCategories(),
  ]);

  return (
    <div>
      {/* Hero */}
      <HeroParallax className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-20 sm:pt-28 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col items-start gap-6">
          <div data-depth="0.5">
            <Badge variant="primary">
              <RotatingBadge period={6}>
                <Sparkles className="size-3" />
              </RotatingBadge>
              Motion-first recipe library
            </Badge>
          </div>
          <div data-depth="0.28">
            <SplitTextHeadline
              text="Every recipe, in motion."
              className="font-display text-5xl font-medium leading-[1.05] tracking-tight sm:text-7xl"
            />
          </div>
          <p
            data-depth="0.18"
            className="max-w-xl text-lg text-muted-foreground"
          >
            Browse, cook, and share recipes. Scale servings with a tap, build a
            shopping list, and follow the cooks you love.
          </p>
          <div data-depth="0.12" className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/recipes">
                Browse recipes
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/recipes/new">Share a recipe</Link>
            </Button>
          </div>
        </div>
        <div
          data-depth="0.85"
          className="justify-self-center lg:justify-self-end"
        >
          <HeroRamen />
        </div>
      </HeroParallax>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-6">
        <Reveal className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/recipes?category=${c.slug}`}
              data-reveal
              className="rounded-full border border-border bg-card px-4 py-1.5 text-sm transition-[transform,border-color,color] duration-150 ease-snappy hover:border-primary/50 hover:text-primary motion-safe:active:scale-[0.97]"
            >
              {c.name}
            </Link>
          ))}
        </Reveal>
      </section>

      {/* Top picks — 3D flip cards */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-3xl font-medium tracking-tight">
              <Flame className="size-5 text-primary" />
              Top picks
            </h2>
            <p className="mt-1 text-muted-foreground">
              The community&apos;s highest-rated dishes. Flip any card for the
              details.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/recipes?sort=top">
              View all <ArrowRight />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.slug}`}
              className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FlipCard3D
                focusable={false}
                className="h-72"
                front={<TopPickFront recipe={recipe} />}
                back={<TopPickBack recipe={recipe} />}
              />
            </Link>
          ))}
        </div>
      </section>

      {/* Recent */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-4">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-3xl font-medium tracking-tight">
              <Clock className="size-5 text-primary" />
              Fresh from the kitchen
            </h2>
            <p className="mt-1 text-muted-foreground">
              The latest recipes added to the library.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/recipes">
              View all <ArrowRight />
            </Link>
          </Button>
        </div>
        <RecipeGrid recipes={recent} showAuthor />
      </section>
    </div>
  );
}
