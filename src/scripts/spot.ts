/**
 * Live gold and silver spot prices for every price display on the page
 * (header ticker, footer, menu, the Sell Gold price board).
 *
 * Markup it fills, inside any [data-spot] element:
 *   [data-price="gold|silver"]             price per troy ounce
 *   [data-melt="gold|silver"][data-purity] melt value per gram at that purity
 *   [data-updated]                         "Updated 2 min ago"
 *
 * Source: gold-api.com directly by default. Once the shop-api Worker is
 * deployed, set PUBLIC_SPOT_SOURCE=worker so prices come from /api/spot
 * (cached 30 s at the edge, shared by all visitors), with gold-api.com as the
 * fallback. A 30-second copy in sessionStorage keeps page-to-page navigation
 * from refetching.
 */
const REFRESH_MS = 60_000;
const CACHE_KEY = 'ngp-spot';
const CACHE_MS = 30_000;
const GRAMS_PER_TROY_OZ = 31.1035;
const USE_WORKER = import.meta.env.PUBLIC_SPOT_SOURCE === 'worker';

interface Quote {
  price: number;
  updatedAt: string;
}
interface Spot {
  gold: Quote;
  silver: Quote;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

async function fromWorker(): Promise<Spot> {
  const res = await fetch('/api/spot', { headers: { Accept: 'application/json' } });
  if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error('worker');
  return res.json();
}

async function direct(): Promise<Spot> {
  const [gold, silver] = await Promise.all(
    ['XAU', 'XAG'].map(async (s) => {
      const res = await fetch(`https://api.gold-api.com/price/${s}`);
      if (!res.ok) throw new Error(s);
      return res.json() as Promise<Quote>;
    }),
  );
  return { gold, silver };
}

function cached(): Spot | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, spot } = JSON.parse(raw);
    return Date.now() - at < CACHE_MS ? spot : null;
  } catch {
    return null;
  }
}

function remember(spot: Spot) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), spot }));
  } catch {
    /* private mode: fine without it */
  }
}

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} hr ago`;
}

let latest: Spot | null = null;
let failed = false;

function render() {
  document.querySelectorAll<HTMLElement>('[data-spot]').forEach((root) => {
    if (!latest) {
      if (failed) {
        root.dataset.state = 'down';
        root.querySelectorAll('[data-updated]').forEach((el) => (el.textContent = 'Live prices unavailable right now'));
      }
      return;
    }
    root.querySelectorAll<HTMLElement>('[data-price]').forEach((el) => {
      el.textContent = usd.format(latest![el.dataset.price as keyof Spot].price);
    });
    root.querySelectorAll<HTMLElement>('[data-melt]').forEach((el) => {
      const perOz = latest![el.dataset.melt as keyof Spot].price;
      el.textContent = usd.format((perOz / GRAMS_PER_TROY_OZ) * Number(el.dataset.purity));
    });
    root.querySelectorAll('[data-updated]').forEach((el) => (el.textContent = `Updated ${ago(latest!.gold.updatedAt)}`));
    root.dataset.state = 'live';
  });
}

async function refresh() {
  try {
    latest = USE_WORKER ? await fromWorker().catch(direct) : await direct();
    failed = false;
    remember(latest);
  } catch {
    failed = !latest; // keep showing the last good prices if we have them
  }
  render();
}

if (document.querySelector('[data-spot]')) {
  latest = cached();
  render();
  if (!latest) refresh();
  setInterval(() => document.visibilityState === 'visible' && refresh(), REFRESH_MS);
  setInterval(render, 15_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !cached()) refresh();
  });
}
