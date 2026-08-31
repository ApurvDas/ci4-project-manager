"use client";

import { SpringPress } from "@/components/motion/SpringPress";
import { Card, CardContent } from "@/components/ui/card";

/** Spring press feedback on a card and a button. */
export function PressDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <SpringPress>
        <Card className="w-40 cursor-pointer">
          <CardContent className="text-center text-sm text-muted-foreground">
            Press me
          </CardContent>
        </Card>
      </SpringPress>
      <SpringPress>
        <span className="inline-flex h-10 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Springy button
        </span>
      </SpringPress>
    </div>
  );
}
