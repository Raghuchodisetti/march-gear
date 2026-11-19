# March Gear — Design System & Frontend Conventions

March Gear is a premium automotive discovery platform for India. The visual language is **editorial, corporate and quiet**: white space, strong type, large photography and a single red accent used sparingly.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4 (tokens in `src/app/globals.css`), Motion (`motion/react`), lucide-react v1.
- `cacheComponents` is **off**. Pages are statically generated from local mock data.
- Next 16 specifics:
  - `params` / `searchParams` are **Promises**. Use the global helper types: `export default async function Page(props: PageProps<"/cars/[slug]">) { const { slug } = await props.params; }`
  - Dynamic routes export `generateStaticParams` and an async `generateMetadata`.
  - Any client component that calls `useSearchParams()` must be rendered inside `<Suspense>` by its server page.
  - `next/image`: use `fill` + a realistic `sizes`, and `preload` (not the deprecated `priority`) for the LCP image. A custom Unsplash loader handles resizing.
- lucide-react v1 has **no brand icons**; social icons live in `src/components/ui/social-icons.tsx`.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `paper` | `#FFFFFF` | Page background |
| `ink` | `#111111` | Primary text, dark sections, dark buttons |
| `ink-2` / `ink-3` | `#202020` / `#2C2C2C` | Raised surfaces on dark |
| `mist` | `#F5F5F5` | Quiet panels, image placeholders |
| `line` | `#E8E8E8` | Borders and dividers |
| `muted` | `#777777` | Secondary text |
| `red` | `#E31E24` | Primary CTA, active state, small highlights only |

Rules: no other hues. Red never fills large areas. Dark sections use `bg-ink` with `text-white` and `white/xx` opacities for hierarchy.

**Type** (utilities in `globals.css`): `type-display` (hero only), `type-h1` (page titles), `type-h2` (section titles), `type-h3`, `type-h4`, `type-eyebrow` (uppercase label), `type-lead`, `type-editorial` (italic serif accent — max one phrase per section), `num` (tabular figures for prices/specs). Display type is Archivo (expanded); UI text is Geist; specs may use `font-mono` sparingly.

**Layout**: wrap content in `container-x` (max 1400px with 20/32/48px gutters). Section vertical rhythm: `py-14 md:py-20` (standard), `py-12 md:py-16` (compact). Grids use `gap-5` for cards, `gap-10`+ for editorial blocks.

**Shape**: corners are nearly square — buttons/inputs `rounded-[3px]`, cards have **no radius** with a `border-line` hairline. Pills (`rounded-full`) only for chips and icon buttons. Shadows only on floating layers (`shadow-soft`, `shadow-lift`) — never on resting cards.

**Breakpoints**: mobile 360–767, tablet `md` 768, laptop `lg` 1024, desktop `3xl` 1440. Design mobile layouts deliberately (stacked, swipeable, bottom bars), not as squeezed desktop.

## Motion

Use `src/lib/motion.ts` (`EASE`, `DURATION`, variants) and `src/components/ui/reveal.tsx`.

- Button hover 250ms · card hover 400ms (image zoom 700ms) · dropdowns 350ms · section reveal 700ms · hero entrance 1200ms · hero zoom 10s.
- `<Reveal>` for single blocks; `<RevealGroup>` + `<RevealItem>` for staggered grids; `<Counter>` for animated numbers.
- Don't animate everything: one reveal per block, no looping motion except the hero and marquee.
- `MotionConfig reducedMotion="user"` is set globally; CSS animations are neutralised by a reduced-motion media query.

## Components (import, don't re-create)

- `ui/button` — `Button` (variants: primary · dark · outline · ghost · light · outline-light · link; `href` makes it a Link; `arrow` adds a nudging arrow), `IconButton`.
- `ui/section-heading` — `SectionHeading`, `Eyebrow`, `TextLink`.
- `ui/page-header` — `PageHeader` (inner-page opener with breadcrumbs; pass `image` for a dark banner), `BrandMonogram`, `EmptyState`, `Spec`.
- `ui/badge` — `Badge`, `VerifiedBadge`, `DemoNote`. `ui/chip` — `Chip` (filter pill).
- `ui/tabs` — `Tabs` (animated underline). `ui/accordion` — `Accordion`.
- `ui/overlay` — `Modal` (sheet on mobile), `Drawer` (right/left/bottom), `useIsClient`.
- `ui/field` — `TextField`, `SelectField`, `TextArea`, `RangeField`, `Segmented`, `Label`.
- `ui/carousel` — `Carousel` (scroll-snap, arrows, progress). `ui/rating` — `Stars`, `RatingInline`, `ScoreBar`. `ui/breadcrumbs`.
- `vehicle/car-card` — `CarCard`, `carHref`, `fuelSummary`, `transmissionSummary`. `vehicle/used-car-card` — `UsedCarCard`, `usedHref`, `usedTitle`, `usedEmi`. `vehicle/toggles` — `WishlistButton`, `CompareToggle`. `vehicle/image-gallery` — `ImageGallery` (swipe + lightbox).
- `listing/filter-bar` — `FilterBar` (sticky row of filter pills, each opening a visual panel; bottom sheet on mobile) with `ImageTiles`, `IconTiles`, `ValueTiles`, `BrandTiles` and `summarise`. Listings never use checkbox sidebars.
- `ui/brand-logo` — `BrandLogo` (full-colour manufacturer logos from `/public/brands`, mapped in `data/brand-logos.ts`) and `logoFit(slug)` for proportion-aware sizing. Colour logos always sit on a white/mist surface, never on ink. `BrandMonogram` renders the logo automatically when the name is a known marque.
- `tools/emi-calculator` — `EmiCalculator` (light/dark, pre-fillable `defaultPrice`, `onChange(inputs)` to build on its figures; remount with a `key` to reset).
- `UsedCarCard` and `CarCard` take `priority` for above-the-fold listing rows. `TextField` takes a `prefix` node (text or icon).
- Above-the-fold entrances (hero copy, `PageHeader`) use the CSS `animate-rise` / `animate-line` keyframes so they paint before hydration; use Motion for in-view reveals below the fold.

## State & interactions (`components/providers/app-provider`)

- `useWishlist()` → `{ has(kind,id), toggle(kind,id,label), clear(kind?), count }` (`kind` = `"cars" | "used"`).
- `useCompare()` → `{ slugs, has, toggle, set, remove, clear, max }` — up to 4 new-car slugs; `/compare?cars=a,b`.
- `useCity()` → `{ city, setCity }`; `onRoadPrice(exShowroom, citySlug, isElectric)` in `data/cities`.
- `useUser()` → mock auth `{ user, login, logout, update }` persisted to localStorage.
- `useUI()` → `openEnquiry({ kind, subject, detail })` (kinds: test-drive · best-price · contact-dealer · callback · inspection), `toast(message, { tone, action })`, `setSearchOpen`, `setLocationOpen`.

Every visible control must do something. Anything that would need a backend is demonstrated with `openEnquiry`, a toast, or local state.

## Data (`src/data`)

`cars` (+ helpers `getCar`, `carsByBrand`, `carsInCategory`, `BUDGETS`, `inBudget`, `isElectric`, `getVariant`), `brands` (`getBrand`, `brandName`), `categories`, `used-cars`, `upcoming`, `news` (`articles`, `authors`), `reviews` (`expertReviews`, `ownerReviews`, `ownerReviewsFor`), `dealers`, `cities`, `tools`, `navigation`, `images` (`IMG` editorial photography). Formatting helpers in `lib/format` (`formatPrice`, `formatPriceRange`, `formatINR`, `formatKm`, `formatDate`, `formatMonth`) and `lib/finance` (`calculateEmi`, `loanBreakdown`).

All prices are indicative demo data — label them ("Ex-showroom · indicative", `DemoNote`).

## Quality bar

- No horizontal overflow at 360px. Wide tables scroll inside `overflow-x-auto`.
- Any `grid` that sets columns only at a breakpoint (`lg:grid-cols-12`) must also set `grid-cols-1` for mobile — otherwise the implicit track sizes to its content and nowrap children (chip rows, carousels) push the page wider than the viewport. Likewise give flex children that contain scrollers `min-w-0`.
- No `Date.now()` / `Math.random()` during render (hydration). Use string-based date helpers.
- Every image has meaningful `alt` (or `alt=""` if decorative). Icon-only buttons have `aria-label`.
- Vary layouts between sections — avoid repeating the same card grid twice on one page.
