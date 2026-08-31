import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipeBySlug } from "@/data/recipes";
import { getComments, getCurrentUser } from "@/data/users";
import { rateRecipe } from "@/lib/actions/ratings";
import { postComment } from "@/lib/actions/comments";
import { addToShoppingList } from "@/lib/actions/shopping";
import { RecipeImage } from "@/components/recipe/RecipeImage";
import { RecipeMeta } from "@/components/recipe/RecipeMeta";
import { ServingsScaler } from "@/components/recipe/ServingsScaler";
import { StepList } from "@/components/recipe/StepList";
import { ReviewsSection } from "@/components/recipe/ReviewsSection";
import { StarRating } from "@/components/ratings/StarRating";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/format";

interface RecipePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: RecipePageProps): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) return { title: "Recipe not found" };
  return { title: recipe.title, description: recipe.description };
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) notFound();

  const [comments, currentUser] = await Promise.all([
    getComments(slug),
    getCurrentUser(),
  ]);

  return (
    <article className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 grid gap-8 md:grid-cols-[1.1fr_1fr] md:items-center">
        <div className="order-2 md:order-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">{recipe.category.name}</Badge>
            {recipe.tags.map((tag) => (
              <Badge key={tag.id} variant="muted">
                {tag.name}
              </Badge>
            ))}
          </div>
          <h1 className="mt-3 font-display text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl">
            {recipe.title}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            {recipe.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <StarRating value={recipe.avgRating} readOnly />
            <span className="text-sm text-muted-foreground">
              {recipe.avgRating.toFixed(1)} ({recipe.ratingCount} ratings)
            </span>
          </div>

          <RecipeMeta
            className="mt-4"
            prepTimeMins={recipe.prepTimeMins}
            cookTimeMins={recipe.cookTimeMins}
            servings={recipe.servings}
            difficulty={recipe.difficulty}
          />

          <Link
            href={`/users/${recipe.author.username}`}
            className="mt-6 inline-flex items-center gap-3 rounded-lg border border-border bg-card p-3 pr-4 transition-colors hover:border-primary/40"
          >
            <Avatar
              name={recipe.author.name}
              image={recipe.author.image}
              className="size-10"
            />
            <span className="text-sm">
              <span className="block text-muted-foreground">Recipe by</span>
              <span className="font-medium">{recipe.author.name}</span>
            </span>
          </Link>
        </div>

        <div className="order-1 overflow-hidden rounded-xl border border-border md:order-2">
          <div className="aspect-[4/3]">
            <RecipeImage
              title={recipe.title}
              imageUrl={recipe.imageUrl}
              hue={recipe.imageHue}
              priority
            />
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ServingsScaler
            ingredients={recipe.ingredients}
            baseServings={recipe.servings}
            recipeSlug={recipe.slug}
            recipeTitle={recipe.title}
            onAddToList={
              currentUser ? addToShoppingList.bind(null, recipe.slug) : undefined
            }
          />
        </div>

        <div>
          <h2 className="mb-4 font-display text-2xl font-medium tracking-tight">
            Method
          </h2>
          <StepList steps={recipe.steps} />

          <p className="mt-8 text-xs text-muted-foreground">
            Published {formatDate(recipe.createdAt)}
          </p>
        </div>
      </div>

      <hr className="my-10 border-border" />

      <ReviewsSection
        recipeSlug={recipe.slug}
        initialComments={comments}
        currentUser={currentUser}
        onRate={currentUser ? rateRecipe.bind(null, recipe.slug) : undefined}
        onComment={currentUser ? postComment.bind(null, recipe.slug) : undefined}
      />
    </article>
  );
}
