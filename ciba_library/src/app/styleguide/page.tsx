import type { Metadata } from "next";
import { Reveal } from "@/components/motion/Reveal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { durations, stagger, cssEases } from "@/lib/motion";
import { HeroDemo } from "./HeroDemo";
import { ServingsDemo } from "./ServingsDemo";
import { ChecklistDemo } from "./ChecklistDemo";
import { PressDemo } from "./PressDemo";
import { Depth3DDemo } from "./Depth3DDemo";

export const metadata: Metadata = {
  title: "Motion styleguide",
  description: "The Ciba Library motion vocabulary, running live.",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-10">
      <div className="mb-6">
        <h2 className="font-display text-2xl font-medium tracking-tight">
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-4">
        <Badge variant="primary" className="mb-3">
          Motion styleguide
        </Badge>
        <p className="max-w-2xl text-muted-foreground">
          Every signature animation in Ciba Library, running live so timing can
          be felt and tuned before it spreads across the app. All motion draws
          from the tokens in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            lib/motion.ts
          </code>{" "}
          and respects <code className="text-sm">prefers-reduced-motion</code>.
        </p>
      </header>

      <Section
        title="Duration & stagger tokens"
        description="Three tiers keep the whole system coherent: micro for feedback, base for transitions, narrative for reveals."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(durations).map(([name, ms]) => (
            <Card key={name}>
              <CardContent>
                <div className="text-sm font-medium capitalize">{name}</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-primary">
                  {ms}
                  <span className="text-sm text-muted-foreground">ms</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(stagger).map(([name, ms]) => (
            <Badge key={name} variant="muted">
              stagger.{name} · {ms}ms
            </Badge>
          ))}
        </div>
      </Section>

      <Section
        title="Editorial type scale"
        description="Newsreader sets magazine-style display headlines; the sans carries body copy and the mono owns numerals and meta. In-headline emphasis uses the same family's italic, never a second font."
      >
        <div className="space-y-4">
          <p className="font-display text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl">
            Every recipe, <em className="italic">in motion</em>.
          </p>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Body copy stays in the sans for readability, with{" "}
            <span className="font-mono tabular-nums text-foreground">4.8</span>{" "}
            ratings and{" "}
            <span className="font-mono tabular-nums text-foreground">35</span>{" "}
            minutes rendered in the mono numerals used across cards and meta.
          </p>
        </div>
      </Section>

      <Section
        title="Interaction easings"
        description="The CSS interaction layer (press, hover, popovers) shares three custom curves with the anime.js tiers, so JS- and CSS-driven motion never drift. Defined once in globals.css and mirrored in lib/motion.ts."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(cssEases).map(([name, curve]) => (
            <Card key={name}>
              <CardContent>
                <div className="text-sm font-medium capitalize">
                  ease-{name}
                </div>
                <code className="mt-1 block text-xs text-muted-foreground">
                  {curve}
                </code>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Animated hero, splitText"
        description="The home headline splits into characters and staggers in. The full string stays readable to screen readers."
      >
        <HeroDemo />
      </Section>

      <Section
        title="Servings scaler, number tweening"
        description="The flagship interaction. Change servings and every quantity counts to its new value with a downward ripple."
      >
        <div className="max-w-md">
          <ServingsDemo />
        </div>
      </Section>

      <Section
        title="Shopping list, self-drawing checks"
        description="Toggling an item draws its checkmark stroke-by-stroke via the SVG drawable."
      >
        <div className="max-w-md">
          <ChecklistDemo />
        </div>
      </Section>

      <Section
        title="Spring press"
        description="Micro-tier tactile feedback. Interactive surfaces dip on press and spring back on release."
      >
        <PressDemo />
      </Section>

      <Section
        title="3D & depth"
        description="Real depth via anime.js-driven CSS 3D: pointer tilt, card flip, parallax, and a spinning coin, plus one true WebGL centerpiece, a bowl of ramen. All flatten or hold still under reduced motion."
      >
        <Depth3DDemo />
      </Section>

      <Section
        title="Scroll reveal"
        description="Cards rise and fade in, staggered, when scrolled into view, the pattern used across every page's content grids."
      >
        <Reveal className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} data-reveal>
              <Card>
                <CardContent className="text-sm text-muted-foreground">
                  Reveal card {i + 1}
                </CardContent>
              </Card>
            </div>
          ))}
        </Reveal>
      </Section>
    </div>
  );
}
