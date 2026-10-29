/**
 * 1200 × 630 social share images, one per page, rendered at build time with
 * satori (text → SVG paths) and sharp (SVG → PNG).
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori from 'satori';
import sharp from 'sharp';
import { business } from '../../data/site';
import { guides } from '../../data/guides';

const pages: Record<string, { eyebrow: string; title: string }> = {
  home: { eyebrow: 'Pawn · Gold & Silver · Firearms', title: 'Fair cash and honest deals on Villa Rica Highway.' },
  'pawn-loans': { eyebrow: 'Pawn loans', title: 'Cash today on the things you own. No credit check.' },
  'sell-gold': { eyebrow: 'We buy gold & silver', title: 'Cash for gold and silver, tested in front of you.' },
  firearms: { eyebrow: 'Firearms', title: 'Buy, sell, and trade with a licensed dealer.' },
  'ffl-transfers': { eyebrow: 'FFL transfers', title: 'Bought a gun online? Ship it here.' },
  about: { eyebrow: 'About us', title: 'A neighborhood pawn shop, run by people who live here.' },
  visit: { eyebrow: 'Visit us', title: '7029 Villa Rica Hwy, Dallas, GA 30157' },
  'get-an-offer': { eyebrow: 'Get an offer', title: 'Send a photo. Get an offer.' },
  guides: { eyebrow: 'Guides', title: 'Straight answers before you come in.' },
  ...Object.fromEntries(guides.map((g) => [g.slug, { eyebrow: 'Guide', title: g.title }])),
};

export const getStaticPaths: GetStaticPaths = () => Object.keys(pages).map((slug) => ({ params: { slug } }));

const require = createRequire(import.meta.url);
const font = (path: string) => readFile(require.resolve(path));
const markReversed = await readFile('public/brand/mark-reversed.svg'); // build runs from the project root
const fontsPromise = Promise.all([
  font('@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff'),
  font('@fontsource/inter/files/inter-latin-500-normal.woff'),
  font('@fontsource/inter/files/inter-latin-600-normal.woff'),
]);

const C = { ink: '#1c1c1a', paper: '#faf8f3', brass: '#a8842c', brassLight: '#d4b46a', charcoal: '#24231f', muted: '#bdb7aa' };

// Minimal hyperscript helper for satori's element tree.
type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string)[]): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.length === 1 ? children[0] : children },
});

export const GET: APIRoute = async ({ params }) => {
  const page = pages[params.slug as string];
  const [playfair, inter500, inter600] = await fontsPromise;

  // The logo mark, reversed for the dark card (same file as public/brand/mark-reversed.svg).
  const mark = (size: number) => ({
    type: 'img',
    props: { src: `data:image/svg+xml;base64,${markReversed.toString('base64')}`, width: size, height: size },
  });

  const tree = h(
    'div',
    {
      width: 1200,
      height: 630,
      background: C.charcoal,
      padding: 28,
    },
    h(
      'div',
      {
        // Content box: 1144 × 574 frame minus 2 px border and 56/64 px padding.
        width: 1012,
        height: 458,
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: `2px solid ${C.brass}`,
        borderRadius: 8,
        padding: '56px 64px',
      },
      h(
        'div',
        { alignItems: 'center', gap: 18 },
        mark(64),
        h('div', { fontFamily: 'Playfair', fontSize: 40, color: C.paper }, business.name),
      ),
      h(
        'div',
        { flexDirection: 'column', gap: 22 },
        h(
          'div',
          { fontFamily: 'Inter', fontWeight: 600, fontSize: 24, letterSpacing: 3, color: C.brassLight, textTransform: 'uppercase' },
          page.eyebrow,
        ),
        h('div', { fontFamily: 'Playfair', fontSize: 68, lineHeight: 1.08, color: C.paper, maxWidth: 1000 }, page.title),
      ),
      h(
        'div',
        { justifyContent: 'space-between', fontFamily: 'Inter', fontWeight: 500, fontSize: 26, color: C.muted },
        h('div', {}, `${business.address.street} · ${business.address.city}, ${business.address.region}`),
        h('div', { color: C.brassLight, fontWeight: 600 }, business.phone),
      ),
    ),
  );

  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Playfair', data: playfair, weight: 600, style: 'normal' },
      { name: 'Inter', data: inter500, weight: 500, style: 'normal' },
      { name: 'Inter', data: inter600, weight: 600, style: 'normal' },
    ],
  });
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true }).toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
