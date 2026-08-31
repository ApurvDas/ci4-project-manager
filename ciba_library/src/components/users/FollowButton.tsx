"use client";

import * as React from "react";
import { animate } from "animejs";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAnimeScope } from "@/hooks/useAnimeScope";
import { springs, motionEnabled } from "@/lib/motion";
import { DrawableCheck } from "@/components/motion/DrawableCheck";
import { Button } from "@/components/ui/button";

interface FollowButtonProps {
  userId: string;
  name: string;
  initialFollowing: boolean;
  /** Wired to a server action in Phase 4. */
  onToggle?: (following: boolean) => Promise<void> | void;
}

/**
 * Optimistic follow/unfollow toggle. Toggling springs the icon and, when you
 * start following, draws a tick in place of the "+" — the same self-drawing
 * check motif used across the app.
 */
export function FollowButton({
  name,
  initialFollowing,
  onToggle,
}: FollowButtonProps) {
  const [following, setFollowing] = React.useState(initialFollowing);
  const [pending, setPending] = React.useState(false);

  const { root, scope } = useAnimeScope((self) => {
    self.add("pop", () => {
      if (self.matches.reduce) return;
      const icon = self.root.querySelector<HTMLElement>("[data-follow-icon]");
      if (icon) animate(icon, { scale: [1, 1.25, 1], ease: springs.bouncy() });
    });
  });

  const toggle = async () => {
    const next = !following;
    setFollowing(next);
    if (motionEnabled()) scope.current?.methods.pop();
    setPending(true);
    try {
      await onToggle?.(next);
      toast.success(next ? `Following ${name}` : `Unfollowed ${name}`);
    } catch {
      setFollowing(!next);
      toast.error("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div ref={root} className="inline-flex">
      <Button
        variant={following ? "outline" : "primary"}
        onClick={toggle}
        disabled={pending}
      >
        <span data-follow-icon className="inline-flex">
          {following ? (
            <DrawableCheck checked className="size-4" />
          ) : (
            <UserPlus className="size-4" />
          )}
        </span>
        {following ? "Following" : "Follow"}
      </Button>
    </div>
  );
}
