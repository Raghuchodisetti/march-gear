# March Gear

A premium automotive discovery platform for the Indian market — research, compare and discover new and used cars. Frontend only: every interaction runs on local mock data.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (all routes statically generated)
npm run lint
```

Requires Node.js 20.9+.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · Motion · lucide-react.

## Where things live

```
src/
  app/                 Routes (home, new/used cars, model & variant pages, compare,
                       reviews, news, EVs, tools, dealers, account, legal)
  components/
    ui/                Design-system primitives (buttons, fields, tabs, modals, carousel…)
    layout/            Header + mega menus, mobile nav, search, location, compare tray, footer
    home/              Homepage sections
    vehicle/           Car cards, used-car cards, gallery, wishlist/compare toggles
    providers/         App state (wishlist, compare, city, mock user, enquiries, toasts)
    …                  Feature folders for each page family
  data/                Mock catalogue, used inventory, dealers, editorial, navigation
  lib/                 Formatting, finance maths, motion tokens, persisted stores
  types/               Domain types
```

The design system — tokens, type scale, motion timings, component inventory and conventions — is documented in [DESIGN.md](DESIGN.md).

## Notes

- All prices, specifications, listings, reviews and dealers are demonstration data.
- Photography is served from Unsplash via a custom `next/image` loader (`src/lib/image-loader.ts`) and is representative — it may not show the exact model described.
- Wishlist, compare list, selected city and the mock signed-in user persist in `localStorage`.
