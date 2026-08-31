import Link from "next/link";
import { Clock, Star } from "lucide-react";
import type { Recipe } from "@/lib/types";
import { RecipeImage } from "./RecipeImage";
import { TiltCard } from "@/components/motion/TiltCard";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface RecipeCardProps {
  recipe: Recipe;
  /** Show the author line (used in feeds). */
  showAuthor?: boolean;
  className?: string;
}

export function RecipeCard({ recipe, showAuthor, className }: RecipeCardProps) {
  return (
    <TiltCard className={cn("h-full rounded-lg", className)}>
      <Link
        href={`/recipes/${recipe.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
      <div className="relative aspect-[4/3] overflow-hidden">
        <RecipeImage
          title={recipe.title}
          imageUrl={recipe.imageUrl}
          hue={recipe.imageHue}
          className="transition-transform duration-500 group-hover:scale-105"
        />
        <Badge
          variant="default"
          className="absolute left-2 top-2 bg-background/85 backdrop-blur"
        >
          {recipe.category.name}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold leading-snug tracking-tight group-hover:text-primary">
          {recipe.title}
        </h3>
        <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
          {recipe.description}
        </p>

        <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="size-4 fill-star text-star" />
            <span className="font-medium text-foreground">
              {recipe.avgRating.toFixed(1)}
            </span>
            <span>({recipe.ratingCount})</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" />
            {recipe.prepTimeMins + recipe.cookTimeMins} min
          </span>
        </div>

        {showAuthor && (
          <div className="mt-1 flex items-center gap-2 border-t border-border pt-3 text-sm">
            <Avatar
              name={recipe.author.name}
              image={recipe.author.image}
              className="size-6"
            />
            <span className="text-muted-foreground">
              by{" "}
              <span className="font-medium text-foreground">
                {recipe.author.name}
              </span>
            </span>
          </div>
        )}
        </div>
      </Link>
    </TiltCard>
  );
}
