"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Isolation boundary for the WebGL centerpiece. three.js is pulled in only on
 * the client, only when the browser supports WebGL, via next/dynamic(ssr:false)
 * so it never runs during SSR and stays out of the main bundle.
 *
 * Fallbacks, in order: no WebGL -> a CSS bowl; reduced motion -> the 3D bowl
 * held still. Either way the hero always shows a bowl of ramen.
 */
const RamenScene = dynamic(() => import("./RamenScene"), {
  ssr: false,
  loading: () => <CssBowl />,
});

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

/** A few scallion bits scattered on the broth. */
const CSS_SCALLIONS = [
  { left: "30%", top: "6%" },
  { left: "62%", top: "18%" },
  { left: "44%", top: "40%" },
  { left: "20%", top: "30%" },
  { left: "72%", top: "48%" },
];

/** Pure-CSS bowl of ramen — the graceful fallback when WebGL is unavailable. */
function CssBowl() {
  return (
    <div className="grid h-full w-full place-items-center">
      <div className="relative h-44 w-64">
        {/* Steam */}
        <div className="absolute inset-x-0 top-0 flex justify-center gap-6 opacity-50 motion-safe:animate-pulse">
          <span className="h-8 w-1 rounded-full bg-gradient-to-t from-transparent to-white/70" />
          <span className="h-10 w-1 rounded-full bg-gradient-to-t from-transparent to-white/70" />
          <span className="h-7 w-1 rounded-full bg-gradient-to-t from-transparent to-white/70" />
        </div>

        {/* Bowl body */}
        <div
          className="absolute bottom-0 left-1/2 h-28 w-60 -translate-x-1/2 rounded-b-[50%] border-x-4 border-b-4 border-[#e0602c]/70"
          style={{ background: "linear-gradient(#f4efe6, #e3dccd)" }}
        />
        {/* Foot */}
        <div className="absolute bottom-0 left-1/2 h-3 w-16 -translate-x-1/2 rounded-b-[50%] bg-[#e3dccd]" />

        {/* Broth surface at the rim */}
        <div
          className="absolute bottom-[6.5rem] left-1/2 h-12 w-56 -translate-x-1/2 overflow-hidden rounded-[100%] border-2 border-[#e0602c]"
          style={{
            background:
              "radial-gradient(circle at 45% 40%, #e3a24d, #c8842e 75%)",
          }}
        >
          {/* Noodle hints */}
          <div className="absolute left-4 top-3 h-6 w-16 rounded-full border-2 border-[#ecd88f]/80" />
          {/* Scallions */}
          {CSS_SCALLIONS.map((s, i) => (
            <span
              key={i}
              className="absolute size-1.5 rounded-full bg-[#6f9e4b]"
              style={{ left: s.left, top: s.top }}
            />
          ))}
          {/* Nori */}
          <div className="absolute left-3 top-1 h-8 w-5 -rotate-6 rounded-sm bg-[#20302a]" />
          {/* Narutomaki */}
          <div className="absolute right-6 top-4 grid size-5 place-items-center rounded-full bg-[#f6eee6]">
            <span className="size-2 rounded-full border-2 border-[#e07a8a]" />
          </div>
        </div>

        {/* Soft-boiled egg */}
        <div
          className="absolute bottom-[6.9rem] left-[52%] size-9 rounded-full shadow-md"
          style={{
            background: "radial-gradient(circle at 40% 35%, #fff8ea, #efe2c2)",
          }}
        >
          <div className="absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e8a13c]" />
        </div>

        {/* Chopsticks */}
        <div className="absolute -right-2 bottom-24 h-1.5 w-40 origin-right -rotate-12 rounded-full bg-[#b98a5e]" />
        <div className="absolute -right-2 bottom-[5.5rem] h-1.5 w-40 origin-right -rotate-[18deg] rounded-full bg-[#b98a5e]" />
      </div>
    </div>
  );
}

export function HeroRamen({ className }: { className?: string }) {
  const [state, setState] = React.useState<"pending" | "webgl" | "css">(
    "pending",
  );

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(supportsWebGL() ? "webgl" : "css");
  }, []);

  return (
    <div aria-hidden className={cn("aspect-square w-full max-w-sm", className)}>
      {state === "webgl" ? (
        <RamenScene reduced={!motionEnabled()} />
      ) : (
        <CssBowl />
      )}
    </div>
  );
}
