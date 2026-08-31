import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";
import { getRecipesByAuthor } from "@/data/recipes";
import {
  getUserByUsername,
  getCurrentUser,
  isFollowing,
  getFollowerCount,
  getFollowingCount,
} from "@/data/users";
import { toggleFollow } from "@/lib/actions/follows";
import { RecipeGrid } from "@/components/recipe/RecipeGrid";
import { FollowButton } from "@/components/users/FollowButton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Avatar } from "@/components/ui/avatar";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) return { title: "Cook not found" };
  return { title: `${user.name} (@${user.username})` };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) notFound();

  const [recipes, currentUser, following, followers, followingCount] =
    await Promise.all([
      getRecipesByAuthor(username),
      getCurrentUser(),
      isFollowing(user.id),
      getFollowerCount(user.id),
      getFollowingCount(user.id),
    ]);

  const isSelf = currentUser?.id === user.id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar
          name={user.name}
          image={user.image}
          className="size-20 text-2xl"
        />
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
          <p className="text-muted-foreground">@{user.username}</p>
          {user.bio && <p className="mt-2 max-w-prose text-sm">{user.bio}</p>}
          <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">
                {recipes.length}
              </span>{" "}
              recipes
            </span>
            <span>
              <span className="font-semibold text-foreground">{followers}</span>{" "}
              followers
            </span>
            <span>
              <span className="font-semibold text-foreground">
                {followingCount}
              </span>{" "}
              following
            </span>
          </div>
        </div>
        {currentUser && !isSelf && (
          <FollowButton
            userId={user.id}
            name={user.name}
            initialFollowing={following}
            onToggle={toggleFollow.bind(null, user.id)}
          />
        )}
      </header>

      <h2 className="mb-6 text-lg font-semibold tracking-tight">
        {isSelf ? "Your recipes" : `Recipes by ${user.name}`}
      </h2>
      {recipes.length > 0 ? (
        <RecipeGrid recipes={recipes} />
      ) : (
        <EmptyState
          icon={UtensilsCrossed}
          title="No recipes yet"
          description={
            isSelf
              ? "Share your first recipe to see it here."
              : `${user.name} hasn't published any recipes yet.`
          }
        />
      )}
    </div>
  );
}
