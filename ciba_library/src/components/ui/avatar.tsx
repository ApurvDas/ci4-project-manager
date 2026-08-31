import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  image?: string | null;
  className?: string;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

/** Circular avatar: image if present, otherwise initials on a tinted disc. */
export function Avatar({ name, image, className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary",
        className,
      )}
      aria-hidden={image ? undefined : true}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name} className="size-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
