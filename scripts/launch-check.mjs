#!/usr/bin/env node
/**
 * Lists everything that still needs the owner or a setup step before launch.
 *   npm run launch-check
 * Exits non-zero while anything is outstanding.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { business, reviews, unconfirmed } from '../src/data/site.ts';

if (existsSync('.env')) process.loadEnvFile('.env');
const env = process.env;
const todo = [];
const check = (ok, message) => ok || todo.push(message);

// Owner confirmations (src/data/site.ts → unconfirmed). Remove lines there as they're confirmed.
for (const item of unconfirmed) todo.push(`Confirm with owner: ${item}`);

check(business.links.googlePlaceId, 'Set business.links.googlePlaceId (enables the /review link)');
check(business.fflTransferFee, 'Set business.fflTransferFee (FFL page shows "Call for current fee" until then)');
check(reviews.length >= 3, `Add owner-approved review quotes (have ${reviews.length}, want 3+)`);

const photos = existsSync('src/assets/photos') ? readdirSync('src/assets/photos').map((f) => f.replace(/\.\w+$/, '')) : [];
for (const p of ['storefront', 'jewelry', 'shop-floor', 'tools', 'guitars', 'gold', 'silver', 'rifles', 'gun-wall', 'owner']) {
  check(photos.includes(p), `Add photo src/assets/photos/${p}.jpg`);
}

check(env.SITE_URL, 'Set SITE_URL to the real domain');
check(env.SHEET_PUB_ID && env.SHEET_GID_HOURS, 'Connect the Google Sheet (SHEET_PUB_ID and SHEET_GID_* variables)');
check(
  env.PUBLIC_TURNSTILE_SITE_KEY && !env.PUBLIC_TURNSTILE_SITE_KEY.startsWith('1x000'),
  'Set PUBLIC_TURNSTILE_SITE_KEY to the real Turnstile site key (currently the test key)',
);
check(env.PUBLIC_CF_BEACON_TOKEN, 'Set PUBLIC_CF_BEACON_TOKEN for Cloudflare Web Analytics');
check(env.PUBLIC_SPOT_SOURCE === 'worker', 'Set PUBLIC_SPOT_SOURCE=worker after deploying the Worker (cached gold/silver prices)');

const wrangler = readFileSync('workers/shop-api/wrangler.toml', 'utf8');
check(!wrangler.includes('REPLACE_WITH_D1_DATABASE_ID'), 'Create the D1 database and put its id in workers/shop-api/wrangler.toml');
check(!/^DEV_TO = ""/m.test(wrangler), 'Set DEV_TO in workers/shop-api/wrangler.toml for build alerts');
const domain = new URL(env.SITE_URL || 'https://newgeorgiapawn.com').hostname;
check(wrangler.includes(domain), `Point workers/shop-api/wrangler.toml routes at ${domain}`);

if (todo.length) {
  console.log(`\n${todo.length} item(s) before launch:\n`);
  todo.forEach((t) => console.log(`  [ ] ${t}`));
  console.log('');
  process.exit(1);
}
console.log('Ready to launch.');
