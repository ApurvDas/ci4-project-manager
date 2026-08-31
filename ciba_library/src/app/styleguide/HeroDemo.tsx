"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { SplitTextHeadline } from "@/components/motion/SplitTextHeadline";
import { Button } from "@/components/ui/button";

/** Replayable splitText headline so the timing can be re-watched on demand. */
export function HeroDemo() {
  const [key, setKey] = React.useState(0);
  return (
    <div className="space-y-4">
      <SplitTextHeadline
        key={key}
        text="Every recipe, in motion."
        className="text-4xl font-semibold tracking-tight sm:text-5xl"
      />
      <Button variant="outline" size="sm" onClick={() => setKey((k) => k + 1)}>
        <RotateCcw />
        Replay
      </Button>
    </div>
  );
}
