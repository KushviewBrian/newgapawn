// @ts-check
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { reviewUrl } from './src/data/site.ts';

if (existsSync('.env')) process.loadEnvFile('.env');

const SITE_URL = process.env.SITE_URL || 'https://newgeorgiapawn.com';

/** Pages kept out of search and the sitemap. */
const NOINDEX = ['/styleguide/', '/offer-sent/', '/review-card/', '/404/'];

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
  // Content-Security-Policy <meta> with hashes for every inline script and
  // style. frame-ancestors and other header-only rules live in public/_headers.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self' https://cloudflareinsights.com",
        'frame-src https://www.facebook.com https://challenges.cloudflare.com',
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ],
      scriptDirective: {
        resources: ["'self'", 'https://challenges.cloudflare.com', 'https://static.cloudflareinsights.com'],
      },
    },
  },
  integrations: [
    sitemap({
      filter: (page) => !NOINDEX.some((p) => page.endsWith(p)),
    }),
    cloudflareRedirects(),
  ],
});
