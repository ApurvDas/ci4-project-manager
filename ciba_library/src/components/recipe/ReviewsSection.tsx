"use client";

import * as React from "react";
import { toast } from "sonner";
import type { Comment, UserSummary } from "@/lib/types";
import { StarRating } from "@/components/ratings/StarRating";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Reveal } from "@/components/motion/Reveal";
import { formatRelative } from "@/lib/format";

interface ReviewsSectionProps {
  recipeSlug: string;
  initialComments: Comment[];
  currentUser: UserSummary | null;
  /** Wired to server actions in Phase 4. */
  onRate?: (value: number) => Promise<void> | void;
  onComment?: (body: string) => Promise<void> | void;
}

/**
 * Ratings + comments. Rating uses the interactive spring star widget; posting a
 * comment optimistically prepends it. Phase 2 keeps everything client-side and
 * toasts; Phase 4 passes real server actions via props.
 */
export function ReviewsSection({
  recipeSlug,
  initialComments,
  currentUser,
  onRate,
  onComment,
}: ReviewsSectionProps) {
  const [myRating, setMyRating] = React.useState(0);
  const [comments, setComments] = React.useState(initialComments);
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const rate = async (value: number) => {
    setMyRating(value);
    try {
      await onRate?.(value);
      toast.success(`Thanks! You rated this ${value} star${value === 1 ? "" : "s"}`);
    } catch {
      toast.error("Couldn't save your rating.");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || !currentUser) return;
    setPending(true);

    const optimistic: Comment = {
      id: `tmp-${Date.now()}`,
      author: currentUser,
      body: trimmed,
      createdAt: new Date().toISOString(),
    };
    setComments((c) => [optimistic, ...c]);
    setBody("");

    try {
      await onComment?.(trimmed);
      toast.success("Comment posted");
    } catch {
      setComments((c) => c.filter((x) => x.id !== optimistic.id));
      toast.error("Couldn't post your comment.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section
      aria-labelledby="reviews-heading"
      data-recipe={recipeSlug}
      className="space-y-6"
    >
      <h2
        id="reviews-heading"
        className="font-display text-2xl font-medium tracking-tight"
      >
        Ratings &amp; comments
      </h2>

      <div className="rounded-lg border border-border bg-card p-4">
        {currentUser ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">Your rating</span>
              <StarRating value={myRating} onChange={rate} />
            </div>
            <form onSubmit={submit} className="mt-4 space-y-3">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share how it went, tweaks you made…"
                rows={3}
                aria-label="Write a comment"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!body.trim() || pending}>
                  {pending ? "Posting…" : "Post comment"}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sign in to rate this recipe and join the conversation.
          </p>
        )}
      </div>

      {comments.length > 0 ? (
        <Reveal className="space-y-4">
          {comments.map((c) => (
            <div
              key={c.id}
              data-reveal
              className="flex gap-3 rounded-lg border border-border bg-card p-4"
            >
              <Avatar name={c.author.name} image={c.author.image} className="size-9" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{c.author.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(c.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
                  {c.body}
                </p>
              </div>
            </div>
          ))}
        </Reveal>
      ) : (
        <p className="text-sm text-muted-foreground">
          No comments yet. Be the first to cook this and report back.
        </p>
      )}
    </section>
  );
}
