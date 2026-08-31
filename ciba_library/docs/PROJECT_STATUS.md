# Ciba Library — Project Status & Resume Plan

_Last updated: 2026-08-31. Read this first when resuming._

A motion-first community food-recipe website. anime.js is the centerpiece —
motion is a signature feature, not decoration — layered over a clean, minimal,
achromatic-plus-terracotta visual style with light **and** dark mode.

---

## 1. Locked-in decisions (do not re-litigate)

- **Framework:** Next.js 16.3.3 (App Router, TypeScript, Turbopack), React 19.2.8, Tailwind CSS v4.
- **Animation:** anime.js v4.5.0 — the differentiator. Four signature animations:
  1. Servings scaler number tweening (`ServingsScaler` + `AnimatedNumber`) ✅ built
  2. Filter/grid FLIP re-layout (`FlipGrid`) ✅ built
  3. Add-to-shopping-list flight along an arc to the cart badge (`flyToCart`) ✅ built
  4. Animated hero splitText + scroll reveals (`SplitTextHeadline`, `Reveal`) ✅ built
- **DB:** PostgreSQL via Prisma. Local dev DB = Docker Postgres (`docker compose up -d`).
- **Auth:** Auth.js / NextAuth v5, email+password (Credentials, JWT strategy) + Google OAuth, `@auth/prisma-adapter`, bcryptjs.
- **Server Actions** preferred over Route Handlers (only NextAuth needs a Route Handler).
- **Data-access layer** (`src/data/*`, all `import "server-only"`): pages import from here.
  Phase 2 reads mock data; Phase 4 swaps bodies to Prisma with **no page changes**.
- **Feature scope:** browse, accounts, recipe submission, ratings + comments, category
  + tag filtering (tags grouped Diet / Meal Type / Cuisine), recipe images, servings
  scaler, DB-persisted per-user shopping list, follow + activity feed.
- **Style:** single sans font (Inter), neutral palette + warm terracotta accent (HSL
  primary hue 18 82% 52%), motion level = showcase/expressive. Reduced-motion respected everywhere.
- **Images:** generated placeholder graphics (inline SVG data URIs, no external service).
  Real uploads go behind a swappable storage abstraction (Phase 3). Deploy target undecided.
- **Seed content:** generated placeholder recipes.

Approved plan file: `C:\Users\Noisemaker\.claude\plans\lets-plan-a-food-declarative-kettle.md`.
Directive in force: **"do all 5 phases together."**

---

## 2. Phase status

| Phase | What | Status |
|------|------|--------|
| 1 | Motion system + `/styleguide` | ✅ Done (tsc + build clean, verified) |
| 2 | Coded frontend on mock data (all components + pages) | ✅ **Done** — see §3 |
| 3 | Backend foundation (Prisma, Auth.js, storage, docker-compose) | ⬜ Next |
| 4 | Wire data layer to Prisma + Server Actions | ⬜ |
| 5 | Seed data + polish + tests (Vitest + Playwright) | ⬜ |

---

## 3. Phase 2 — what was built (all verified)

`npx tsc --noEmit` clean · `npx eslint .` clean · `npx next build` succeeds (12 routes) ·
every route returns 200 on the dev server · detail page renders the servings control,
add-to-list button, method steps, and reviews.

**Motion/logic libs:** `src/lib/motion.ts`, `useAnimeScope`, `src/lib/scaling.ts`,
`src/lib/search.ts`, `src/lib/placeholder.ts`, `src/lib/format.ts` (new),
`src/lib/fly-to-cart.ts` (new), `src/lib/validation.ts` (new — zod schemas shared with
Phase 4 server actions; note `RecipeInput` = `z.output`, `RecipeFormValues` = `z.input`).

**Recipe components (`src/components/recipe/`):** RecipeCard, RecipeGrid, RecipeImage,
RecipeMeta, FlipGrid, FilterPanel, SortSelect, Pagination, ServingsScaler, StepList,
ReviewsSection, RecipeForm (react-hook-form + useFieldArray + useWatch), RecipeCardSkeleton.

**Other components:** `ratings/StarRating`, `users/FollowButton`, `shopping/ShoppingList`,
`dashboard/DashboardNav`, `auth/LoginForm`, `auth/RegisterForm`, plus Phase-1 motion +
UI primitives.

**Pages (`src/app/`):** `/` (hero + top + recent grids), `/recipes` (filter + FlipGrid +
pagination), `/recipes/[slug]`, `/recipes/new`, `/recipes/[slug]/edit`, `/users/[username]`,
`/dashboard` (+ layout + nav), `/dashboard/recipes`, `/dashboard/shopping-list`,
`/login`, `/register`. Polish: `not-found.tsx`, `error.tsx`, `recipes/loading.tsx`,
`recipes/[slug]/loading.tsx`.

**Phase-2 interaction stubs:** every mutating component takes an optional `onSubmit` /
`onRate` / `onComment` / `onToggle` / `onAddToList` / `onRemove` / `onClearChecked` /
`onToggle` prop. In Phase 2 they toast + optimistically update (or redirect). **In Phase 4,
pass the real Server Actions into these props — the wiring points already exist.**

**3D / depth pass (post–Phase 2, anime.js-centric).** Verified: tsc + eslint clean,
`next build` succeeds (12 routes, `/` still static — the WebGL Canvas is behind an
`ssr:false` dynamic boundary with a CSS-bowl fallback in the initial HTML).
- Tokens: `depth = { perspective: 900, tilt:{max,lift} }` in `lib/motion.ts`.
- `hooks/useTilt.ts` — pointer-tracked rotateX/Y + Z-lift + glare, springs back, reduced-motion no-op.
- `components/motion/`: `TiltCard` (wraps every `RecipeCard`, so all grids get depth),
  `FlipCard3D` (true rotateY flip; homepage "Top picks" trio, `focusable={false}` when link-wrapped),
  `HeroParallax` (children with `data-depth="n"` drift with pointer inside one perspective),
  `RotatingBadge` (slow rotateY coin; wraps the hero badge's Sparkles icon),
  `HeroRamen` + `RamenScene` (the **one** WebGL piece — react-three-fiber bowl of ramen:
  ceramic bowl, terracotta rim, broth, egg, chopsticks;
  deps: `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`).
- Homepage hero rebuilt as a `HeroParallax` two-column grid (text left, ramen bowl right).
- `/styleguide` has a "3D & depth" section (`Depth3DDemo.tsx`) demoing all five.
- Note: literal `svg.morphTo` not used for the bowl — WebGL is the intentional 3D path;
  everything else is anime.js-driven CSS 3D. All effects flatten/hold still under reduced motion.

---

## 4. Next up — Phase 3 (backend foundation)

Do NOT change page/component code in Phase 3. Only add backend infrastructure.

1. **Prisma** — `prisma/schema.prisma` with models mirroring `src/lib/types.ts`:
   User, Account, Session, VerificationToken (NextAuth), Category, Tag (**with `group` enum
   Diet/MealType/Cuisine**), Recipe, Ingredient, Step, Rating, Comment, Follow,
   **ShoppingListItem** (per-user, optional recipe link, `checked` bool). Difficulty enum
   EASY/MEDIUM/HARD. Add `passwordHash` on User.
2. `src/lib/db.ts` — PrismaClient singleton (global in dev to survive HMR).
3. **Auth.js v5** — `src/auth.ts` (NextAuth config: PrismaAdapter, Credentials with bcrypt
   compare, Google provider, JWT session, callbacks putting `id`/`username` on session),
   `src/app/api/auth/[...nextauth]/route.ts`, `middleware.ts` (protect `/dashboard`,
   `/recipes/new`, `/recipes/[slug]/edit`). Register action + password hashing.
4. **Storage abstraction** — `src/lib/storage.ts` with a `Storage` interface and a local-disk
   implementation (writes to `public/uploads`), swappable later for S3/blob.
5. `.env.example` (DATABASE_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET), and
   `docker-compose.yml` (postgres:16, volume, port 5432).
6. Verify: `npx prisma generate`, `npx tsc --noEmit`, `npx next build`. Live DB queries need
   **Docker Desktop running** (see §6).

## 5. Then Phase 4 (wire real data) and Phase 5 (seed + tests)

- **Phase 4:** replace bodies in `src/data/*` with Prisma queries (signatures unchanged);
  add `buildRecipeWhere(filters)` in `src/lib/search.ts` (mirror `matchesFilters` as a Prisma
  where-clause); write Server Actions for recipes (create/update), ratings, comments, follows,
  shopping-list (add/toggle/remove/clear), and image upload; pass them into the components'
  `on*` props; derive `getCurrentUser` from the auth session; make Navbar auth-aware + live
  cart count; wire Google + credentials sign-in in the auth forms.
- **Phase 5:** `prisma/seed.ts` (port the generated recipes/users/tags from `src/mocks/data.ts`
  into DB rows); polish empty/loading/error states in both themes + reduced motion; Vitest unit
  tests for `scaling.ts` and `search.ts`; Playwright e2e smoke (browse → filter → detail →
  scale servings → add to list → sign in).

---

## 6. Environment notes / gotchas

- **Node 24.15.0, npm 11.12.1. Docker 29.3.1 installed but daemon NOT running** — start Docker
  Desktop before `docker compose up -d` for a live DB.
- A `next dev` server is already running on **http://localhost:3000** (started by the user).
  Reuse it; a second `next dev` refuses to bind. Smoke-test with `curl localhost:3000/...`.
- `next.config.ts` has `agentRules: false` to stop Next auto-generating CLAUDE.md/AGENTS.md — keep it.
- `next lint` is removed in Next 16 — lint with `npx eslint .`.
- Zod v4: use `z.email()` / `z.url()` (top-level), not the deprecated string `.email()`/`.url()`.
  Coerced-number fields make RHF input≠output types — `useForm<RecipeFormValues, unknown, RecipeInput>`.
- ESLint rule `react-hooks/set-state-in-effect` is an **error** here: sync external props via
  render-time state adjustment (see `FilterPanel`), not an effect.
- Chrome extension for screenshots was not connected — verify via curl/build, don't rabbit-hole.
- `layout.tsx` uses an explicit `{ children: React.ReactNode }` type (NOT the Next-generated
  `LayoutProps` global, which only exists post-build).

## 7. Verify-everything commands

```bash
cd C:/Users/Noisemaker/Desktop/level-1/ciba_library
npx tsc --noEmit          # types
npx eslint .              # lint
npx next build            # prod build (12 routes today)
# runtime smoke (dev server already on :3000):
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/recipes
```

## 8. App URLs (all live on the dev server)

http://localhost:3000/ · /recipes · /recipes/[slug] · /recipes/new · /recipes/[slug]/edit ·
/users/[username] · /dashboard · /dashboard/recipes · /dashboard/shopping-list · /login ·
/register · /styleguide
