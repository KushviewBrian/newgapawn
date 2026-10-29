# New Georgia Pawn — website

Static site for New Georgia Pawn Shop, 7029 Villa Rica Hwy, Dallas, GA. Built with
[Astro](https://astro.build), hosted free on Cloudflare Pages, with one small
Cloudflare Worker for the offer form, click counts, and scheduled rebuilds.

## Quick start

```sh
npm install
cp .env.example .env      # optional for local work
npm run dev               # http://localhost:4321
npm run build             # → dist/
npm run launch-check      # what's still needed before launch
```

`SHOP_FIXTURES=1 npm run dev` previews the closure banner and special hours
with sample data.

## How it fits together

| Piece | Where | What it does |
| --- | --- | --- |
| Pages | `src/pages/` | Home, Pawn Loans, Sell Gold, Firearms, FFL Transfers, About, Visit, Get an Offer, guides, privacy, store policies, 404, `/styleguide/` (hidden) |
| Business facts | `src/data/site.ts` | Name, phone, address, FFL, links, review quotes, and the list of facts still to confirm |
| Hours, closures, banner, rating | Google Sheet → `scripts/sync-data.mjs` → `src/data/generated/shop.json` | Pulled at every build. Without a Sheet, `src/data/shop.defaults.json` is used |
| Facebook | `src/components/FacebookFeed.astro` | Meta's Page Plugin for the shop's public Page, rendered by the Facebook JS SDK, which loads only when scrolled near |
| Map | `scripts/data/osm-roads.json` → `npm run map` → `src/data/map.json` | Static SVG map drawn from OpenStreetMap data; no map scripts |
| Share images | `src/pages/og/[slug].png.ts` | 1200 × 630 image per page, rendered at build |
| Design tokens | `src/styles/tokens.css` | Colors, type, spacing; see `/styleguide/` |
| Worker | `workers/shop-api/` | `/api/offer`, `/api/track`, `/api/publish`, cron rebuilds, closure reminders, monthly summary |

The Open/Closed badge and today's row in the hours table are computed in the
visitor's browser on Eastern Time. Everything else is plain HTML that works
without JavaScript.

## The owner's Google Sheet

Publish the Sheet with **File → Share → Publish to web → Entire document → CSV**
and set `SHEET_PUB_ID` plus each tab's `gid` in the Pages environment.

| Tab | Columns | Notes |
| --- | --- | --- |
| Hours | Day, Opens, Closes | One row per day; leave Opens/Closes blank for closed. Times like `10am`, `6:00 PM` |
| Closures | Date, Through, Reason, Opens, Closes | Blank Through = one day. Blank Opens/Closes = closed all day |
| Banner | Message, Show from, Show until | Optional custom banner; otherwise closures in the next 10 days create one |
| Settings | Key, Value | `rating`, `review_count`, `rating_source`, `rating_url` |

A mistake in the Sheet fails the build with a message naming the tab and row,
so the last good version of the site stays live.

After editing, the owner taps their bookmarked **Publish now** link
(`https://<domain>/api/publish?key=<PUBLISH_KEY>`), or waits for the next
3-hourly rebuild. The Worker emails the shop a reminder to add each new closure
to Google Business Profile special hours, because Google doesn't read them from
the website.

## Deploying

### 1. Cloudflare Pages (the site)

1. Pages → Create → Connect to Git → this repository.
2. Build command `npm run build`, output directory `dist`, Node 22+.
3. Environment variables (Production): everything in `.env.example`.
4. Custom domain: add the root domain; add a Redirect Rule `www.* → https://<domain>/$1` (301).
5. Settings → Builds → **Deploy hooks**: create one; it's the Worker's `DEPLOY_HOOK_URL`.
6. Turn on Web Analytics and copy the token into `PUBLIC_CF_BEACON_TOKEN`, or let Pages inject it automatically.

Security headers come from `public/_headers`; redirects (`/review`, `/offer`,
`/hours`…) are written to `dist/_redirects` at build. The Content-Security-Policy
is appended to `dist/_headers` at build, with a hash for every inline script.

### 2. Worker (`workers/shop-api`)

```sh
cd workers/shop-api
npx wrangler d1 create newgapawn          # copy the id into wrangler.toml
npx wrangler d1 execute newgapawn --remote --file=schema.sql
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put DEPLOY_HOOK_URL
npx wrangler secret put PUBLISH_KEY       # long random string
npx wrangler deploy
```

Before deploying, in the Cloudflare dashboard:

- **Email Routing**: enable it on the domain, verify the shop's Gmail (and
  `DEV_TO`, if set) as destination addresses, and optionally forward
  `info@<domain>` to the Gmail.
- **Turnstile**: create a widget for the domain; the site key goes in
  `PUBLIC_TURNSTILE_SITE_KEY`, the secret in the Worker.
- Update `routes`, `SITE_URL`, and `MAIL_FROM` in `wrangler.toml` if the domain
  isn't `newgeorgiapawn.com`.

## Logo and brand files

The mark is the pawnbroker's three balls on an arched hanger, with the
site's brass diamond as the hook. It's drawn in `src/components/LogoMark.astro`
for the site; `node scripts/make-brand.mjs` regenerates every other copy:

| File | Use |
| --- | --- |
| `public/brand/logo-horizontal(.svg/.png)` and `-reversed.svg` | Letterhead, invoices, signage, light or dark backgrounds |
| `public/brand/logo-stacked(.svg/.png)` and `-reversed.svg` | Square spaces, window decals, business cards |
| `public/brand/mark(.svg/.png)` and `mark-reversed.svg` | The symbol alone |
| `public/brand/facebook-profile.png` | 1080 × 1080 profile picture for Facebook and Google |
| `public/favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-*.png` | Browser and phone icons |

Text in the SVG lockups is outlined, so printers don't need the fonts.
Colors: brass `#a8842c`, highlight `#d4b46a`, charcoal `#24231f`, cream `#f4f1ea`.

## Photos

Drop the on-site photos into `src/assets/photos/` named `storefront`,
`counter`, `gold-case`, `gun-wall`, and `owner` (`.jpg`, any size). Pages pick
them up automatically and Astro generates responsive AVIF/WebP versions. Until
then, the pages use photo-free layouts.

## Before launch

Run `npm run launch-check`. It lists the owner confirmations from
`src/data/site.ts`, missing photos, and any setup values still on defaults.
Delete each line from `unconfirmed` in `src/data/site.ts` as the owner confirms it.

Map data © OpenStreetMap contributors (ODbL).
