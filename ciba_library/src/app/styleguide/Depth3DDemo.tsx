"use client";

import { Sparkles, Clock, Star } from "lucide-react";
import { TiltCard } from "@/components/motion/TiltCard";
import { FlipCard3D } from "@/components/motion/FlipCard3D";
import { HeroParallax } from "@/components/motion/HeroParallax";
import { RotatingBadge } from "@/components/motion/RotatingBadge";
import { HeroRamen } from "@/components/motion/HeroRamen";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Live gallery of the 3D vocabulary: anime.js-driven CSS 3D (tilt, flip,
 * parallax, spinning coin) plus the single WebGL centerpiece. Everything here
 * degrades to flat/static under reduced motion.
 */
export function Depth3DDemo() {
  return (
    <div className="space-y-8">
      <div>
        <p className="mb-3 text-sm font-medium">Pointer tilt + glare</p>
        <div className="max-w-xs">
          <TiltCard className="rounded-xl">
            <Card className="rounded-xl">
              <CardContent className="flex h-40 flex-col justify-between">
                <Badge variant="primary" className="w-fit">
                  <Sparkles className="size-3" /> Tilt me
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Move your pointer across the card and it leans into the
                  cursor, with a soft sheen that follows.
                </p>
              </CardContent>
            </Card>
          </TiltCard>
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">3D flip (hover or focus)</p>
        <FlipCard3D
          className="h-44 w-64"
          front={
            <div className="grid h-full place-items-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
              Front, hover to flip
            </div>
          }
          back={
            <div className="flex h-full flex-col justify-center gap-2 rounded-xl border border-primary/40 bg-primary p-4 text-primary-foreground">
              <span className="inline-flex items-center gap-2 text-sm">
                <Star className="size-4 fill-current" /> 4.8 rating
              </span>
              <span className="inline-flex items-center gap-2 text-sm">
                <Clock className="size-4" /> 35 min total
              </span>
            </div>
          }
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Parallax field</p>
        <HeroParallax className="flex h-40 items-center justify-center gap-8 overflow-hidden rounded-xl border border-border bg-card">
          <span data-depth="0.15" className="text-4xl">
            🍚
          </span>
          <span data-depth="0.4" className="text-5xl">
            🥢
          </span>
          <span data-depth="0.8" className="text-6xl">
            🍜
          </span>
        </HeroParallax>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Rotating coin</p>
        <RotatingBadge>
          <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Sparkles className="size-6" />
          </span>
        </RotatingBadge>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">
          WebGL centerpiece, bowl of ramen
        </p>
        <HeroRamen className="max-w-[16rem]" />
      </div>
    </div>
  );
}
