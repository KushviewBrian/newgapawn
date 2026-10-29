// @ts-check
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { reviewUrl } from './src/data/site.ts';

if (existsSync('.env')) process.loadEnvFile('.env');

const SITE_URL = process.env.SITE_URL || 'https://newgeorgiapawn.com';

/** Pages kept out of search and the sitemap. */
const NOINDEX = ['/styleguide/', '/offer-sent/', '/review-card/', '/404/'];

/**
 * Content-Security-Policy, sent as a header from dist/_headers. Inline
 * scripts are allowed only by hash (computed from the built pages);
 * inline styles are allowed because the Facebook SDK injects them.
 */
const CSP = (scriptHashes) =>
  [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')} https://connect.facebook.net https://*.facebook.com https://challenges.cloudflare.com https://static.cloudflareinsights.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https://*.facebook.com https://*.fbcdn.net",
    "font-src 'self'",
    "connect-src 'self' https://cloudflareinsights.com https://*.facebook.com",
    'frame-src https://*.facebook.com https://challenges.cloudflare.com',
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => `${e.parentPath}/${e.name}`);
}

/** sha256 hashes of every executable inline <script> in the build. */
async function inlineScriptHashes(dir) {
  const hashes = new Set();
  for (const file of await htmlFiles(dir)) {
    const html = await readFile(file, 'utf8');
    for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/\ssrc=/.test(attrs) || /type="application\/(ld\+)?json"/.test(attrs) || !body.trim()) continue;
      hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
    }
  }
  return [...hashes].sort();
}

/** Adds the CSP to Cloudflare's _headers file in the build output. */
function contentSecurityPolicy() {
  return {
    name: 'content-security-policy',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const hashes = await inlineScriptHashes(fileURLToPath(dir));
        // Cloudflare applies one block per path, so add the CSP to the existing /* block.
        const file = new URL('_headers', dir);
        const headers = await readFile(file, 'utf8');
        await writeFile(file, headers.replace(/^\/\*\n/m, `/*\n  Content-Security-Policy: ${CSP(hashes)}\n`));
      },
    },
  };
}

/** Writes Cloudflare's _redirects file into the build output. */
function cloudflareRedirects() {
  return {
    name: 'cloudflare-redirects',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const review = reviewUrl ?? '/about/#reviews';
        const lines = [
          `/review ${review} 302`,
          `/offer /get-an-offer/ 301`,
          `/contact /visit/ 301`,
          `/hours /visit/#hours 301`,
          `/reviews /about/#reviews 301`,
        ];
        await writeFile(new URL('_redirects', dir), lines.join('\n') + '\n');
      },
    },
  };
}

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'always',
  },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  // No code blocks on this site; Shiki's inline styles would conflict with the CSP.
  markdown: { syntaxHighlight: false },
  integrations: [
    sitemap({
      filter: (page) => !NOINDEX.some((p) => page.endsWith(p)),
    }),
    cloudflareRedirects(),
    contentSecurityPolicy(),
  ],
});
