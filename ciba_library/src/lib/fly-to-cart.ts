import { animate } from "animejs";
import { durations, eases, springs, motionEnabled } from "./motion";

/**
 * Fires a small ghost that arcs from a source element to the navbar cart badge,
 * then pops the badge. Fire-and-forget: safe to call on every "add" click. No-op
 * when motion is reduced or the badge isn't mounted (e.g. logged-out nav).
 *
 * The arc comes from tweening Y through a lifted midpoint keyframe while X moves
 * straight across — cheaper and more reliable than a real SVG motion path
 * between two arbitrary screen points.
 */
export function flyToCart(source: HTMLElement | null): void {
  if (!source || !motionEnabled() || typeof document === "undefined") return;

  const badge = document.getElementById("cart-badge");
  if (!badge) return;

  const from = source.getBoundingClientRect();
  const to = badge.getBoundingClientRect();

  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const endX = to.left + to.width / 2;
  const endY = to.top + to.height / 2;

  const dx = endX - startX;
  const dy = endY - startY;
  // Lift the apex above whichever endpoint is higher for a satisfying toss.
  const lift = -Math.max(80, Math.abs(dx) * 0.35);

  const ghost = document.createElement("span");
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: "14px",
    height: "14px",
    marginLeft: "-7px",
    marginTop: "-7px",
    borderRadius: "9999px",
    background: "hsl(var(--primary))",
    boxShadow: "0 4px 12px hsl(var(--primary) / 0.5)",
    pointerEvents: "none",
    zIndex: "9999",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(ghost);

  animate(ghost, {
    translateX: dx,
    translateY: [
      { to: dy * 0.5 + lift, ease: eases.out, duration: durations.base },
      { to: dy, ease: eases.in, duration: durations.base },
    ],
    scale: [{ to: 1.1 }, { to: 0.35 }],
    opacity: [{ to: 1, duration: 0 }, { to: 0.9 }, { to: 0.4 }],
    duration: durations.narrative,
    ease: eases.out,
    onComplete: () => {
      ghost.remove();
      animate(badge, {
        scale: [{ to: 1.4 }, { to: 1 }],
        ease: springs.bouncy(),
      });
    },
  });
}
