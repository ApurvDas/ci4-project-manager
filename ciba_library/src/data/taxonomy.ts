import "server-only";
import type { Category, Tag, TagGroup } from "@/lib/types";
import { prisma } from "@/lib/db";
import { toCategory, toTag } from "./mappers";

export async function getCategories(): Promise<Category[]> {
  const rows = await prisma.category.findMany({ orderBy: { name: "asc" } });
  return rows.map(toCategory);
}

export async function getTags(): Promise<Tag[]> {
  const rows = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return rows.map(toTag);
}

/** Tags grouped by their group, for the filter sidebar. */
export async function getGroupedTags(): Promise<Record<TagGroup, Tag[]>> {
  const grouped: Record<TagGroup, Tag[]> = {
    Diet: [],
    "Meal Type": [],
    Cuisine: [],
  };
  for (const tag of await getTags()) grouped[tag.group].push(tag);
  return grouped;
}
