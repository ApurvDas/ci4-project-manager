import "server-only";
import { auth } from "@/auth";

/** Current user's id, or null when signed out. */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Current user's id, throwing when signed out — for mutating server actions. */
export async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (!id) throw new Error("You must be signed in to do that.");
  return id;
}
