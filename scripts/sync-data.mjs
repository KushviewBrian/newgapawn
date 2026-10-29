#!/usr/bin/env node
/**
 * Build step: pulls hours, closures, the banner, and the rating from the
 * owner's Google Sheet into src/data/generated/shop.json, which every page
 * reads. Without a Sheet configured it uses src/data/shop.defaults.json.
 *
 * If the Sheet is configured but unreachable or has a mistake, this exits
 * with an error. Cloudflare then keeps the last good deployment live.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readSheet, sheetConfigured } from './lib/sheet.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
const env = process.env;

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

/** Today's date in the shop's time zone, as YYYY-MM-DD. */
function todayEastern() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

const defaults = await readJson('../src/data/shop.defaults.json');
const today = todayEastern();
let source = 'defaults';
let data = { hours: defaults.hours, closures: defaults.closures, banners: [], rating: defaults.rating };

if (sheetConfigured(env)) {
  try {
    data = await readSheet(env, defaults);
    source = 'sheet';
  } catch (e) {
    console.error(`\n✖ ${e.message}\n`);
    console.error('Build stopped so the current site stays live. Fix the Sheet and press Publish now.');
    process.exit(1);
  }
} else if (env.SHOP_FIXTURES === '1') {
  const fx = await readJson('../fixtures/shop.json');
  // Fixture dates are relative (days from today) so previews stay current.
  const shift = (n) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  data.closures = fx.closures.map(({ startIn, endIn, ...c }) => ({ ...c, start: shift(startIn), end: shift(endIn ?? startIn) }));
  data.banners = fx.banners;
  source = 'fixtures';
} else {
  console.log('No Google Sheet configured; using src/data/shop.defaults.json.');
}

// Keep closures that haven't ended and are within the next year.
const yearOut = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
const closures = data.closures.filter((c) => c.end >= today && c.start <= yearOut);

// An owner-written banner wins; otherwise the build writes one for any
// closure in the next 10 days (see src/lib/banner.ts).
const banner =
  data.banners.find((b) => (!b.from || b.from <= today) && (!b.until || b.until >= today)) ?? null;

const out = {
  source,
  builtAt: new Date().toISOString(),
  hours: data.hours,
  closures,
  banner: banner && { message: banner.message, until: banner.until },
  rating: data.rating,
};

await mkdir(new URL('../src/data/generated/', import.meta.url), { recursive: true });
await writeFile(new URL('../src/data/generated/shop.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(`Shop data from ${source}: ${closures.length} upcoming closure(s), banner ${banner ? 'on' : 'auto'}.`);
