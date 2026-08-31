import { placeholderDataUri, initials } from "@/lib/placeholder";
import { cn } from "@/lib/utils";

interface RecipeImageProps {
  title: string;
  imageUrl: string | null;
  hue: number;
  className?: string;
  priority?: boolean;
}

/**
 * Recipe image with a generated gradient fallback, so seeded or image-less
 * recipes never show a broken image. Uses a plain <img> because the fallback is
 * an inline data URI (next/image can't optimize those).
 */
export function RecipeImage({
  title,
  imageUrl,
  hue,
  className,
  priority,
}: RecipeImageProps) {
  const src = imageUrl ?? placeholderDataUri(hue, initials(title));
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={imageUrl ? title : ""}
      loading={priority ? "eager" : "lazy"}
      className={cn("size-full object-cover", className)}
    />
  );
}
