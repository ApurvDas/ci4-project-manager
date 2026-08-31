"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/session";

/** Follow or unfollow another user. No-op self-follow guard included. */
export async function toggleFollow(
  targetUserId: string,
  following: boolean,
): Promise<void> {
  const userId = await requireUserId();
  if (userId === targetUserId) return;

  const key = {
    followerId_followingId: { followerId: userId, followingId: targetUserId },
  };

  if (following) {
    await prisma.follow.upsert({
      where: key,
      create: { followerId: userId, followingId: targetUserId },
      update: {},
    });
  } else {
    await prisma.follow
      .delete({ where: key })
      .catch(() => undefined); // already gone — treat as success
  }

  revalidatePath("/dashboard");
}
