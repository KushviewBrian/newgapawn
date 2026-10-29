#!/usr/bin/env node
/**
 * Generates the logo files from the master mark:
 *   public/brand/   SVG + PNG logos for print, signage, and social
 *   public/         favicons, Apple touch icon, PWA icons
 * Text in the lockups is outlined (rendered to paths with satori), so the
 * files look right anywhere without the fonts installed.
 *
 *   node scripts/make-brand.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori from 'satori';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const C = { ink: '#1c1c1a', paper: '#faf8f3', cream: '#f4f1ea', brass: '#a8842c', brassLight: '#d4b46a', charcoal: '#24231f', muted: '#5f5b52', mutedDark: '#bdb7aa' };

/** The mark on a 64-unit grid; `hanger` is the hanger and hook-stem color. */
const markBody = (hanger) => `
  <g fill="none" stroke="${hanger}" stroke-width="2.6" stroke-linecap="round">
    <path d="M32 9.5V41"/>
    <path d="M13 33.5C13 21 21.5 14.5 32 14.5S51 21 51 33.5"/>
  </g>
  <path d="M32 2.5 36 6.5 32 10.5 28 6.5Z" fill="${C.brass}"/>
  <g fill="${C.brass}"><circle cx="13" cy="41.5" r="8.5"/><circle cx="51" cy="41.5" r="8.5"/><circle cx="32" cy="50.5" r="8.5"/></g>
  <g fill="${C.brassLight}" fill-opacity="0.85"><circle cx="10" cy="38.5" r="2"/><circle cx="48" cy="38.5" r="2"/><circle cx="29" cy="47.5" r="2"/></g>`;

const markSvg = (hanger, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bg ? `<rect width="64" height="64" fill="${bg}"/>` : ''}${markBody(hanger)}</svg>`;

const font = (p) => readFile(require.resolve(p));
const [playfair, inter600] = await Promise.all([
  font('@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff'),
  font('@fontsource/inter/files/inter-latin-600-normal.woff'),
]);
const fonts = [
  { name: 'Playfair', data: playfair, weight: 600, style: 'normal' },
  { name: 'Inter', data: inter600, weight: 600, style: 'normal' },
];

const h = (type, style, ...children) => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.length === 1 ? children[0] : children },
});
const img = (svg, size) => ({
  type: 'img',
  props: { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, width: size, height: size },
});

/** Logo lockup as an outlined SVG string. */
async function lockup({ layout, dark }) {
  const hanger = dark ? C.cream : C.charcoal;
  const name = dark ? C.cream : C.ink;
  const place = dark ? C.mutedDark : C.muted;
  const mark = img(markSvg(hanger), layout === 'stacked' ? 260 : 150);
  const text = (align) =>
    h(
      'div',
      { flexDirection: 'column', alignItems: align },
      h('div', { fontFamily: 'Playfair', fontSize: 92, color: name, lineHeight: 1, letterSpacing: -1 }, 'New Georgia Pawn'),
      h('div', { fontFamily: 'Inter', fontSize: 27, color: place, letterSpacing: 7, marginTop: 16 }, 'DALLAS, GEORGIA'),
    );
  const [w, ht, tree] =
    layout === 'stacked'
      ? [900, 560, h('div', { width: 900, height: 560, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28 }, mark, text('center'))]
      : [1060, 200, h('div', { width: 1060, height: 200, alignItems: 'center', gap: 34 }, mark, text('flex-start'))];
  return satori(tree, { width: w, height: ht, fonts });
}

/** Square social avatar: mark on charcoal, name underneath (survives a circular crop). */
async function avatar() {
  const tree = h(
    'div',
    { width: 1080, height: 1080, background: C.charcoal, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 34 },
    img(markSvg(C.cream), 470),
    h('div', { fontFamily: 'Playfair', fontSize: 84, color: C.cream, lineHeight: 1 }, 'New Georgia Pawn'),
    h('div', { fontFamily: 'Inter', fontSize: 30, color: C.brassLight, letterSpacing: 8 }, 'PAWN · GOLD · GUNS'),
  );
  return satori(tree, { width: 1080, height: 1080, fonts });
}

const png = (svg, width) => sharp(Buffer.from(svg), { density: 300 }).resize({ width }).png({ compressionLevel: 9 }).toBuffer();
const out = (p) => new URL(`../public/${p}`, import.meta.url);

await mkdir(out('brand/'), { recursive: true });

const files = {
  'brand/mark.svg': markSvg(C.charcoal),
  'brand/mark-reversed.svg': markSvg(C.cream),
  'brand/logo-horizontal.svg': await lockup({ layout: 'horizontal', dark: false }),
  'brand/logo-horizontal-reversed.svg': await lockup({ layout: 'horizontal', dark: true }),
  'brand/logo-stacked.svg': await lockup({ layout: 'stacked', dark: false }),
  'brand/logo-stacked-reversed.svg': await lockup({ layout: 'stacked', dark: true }),
};
for (const [p, svg] of Object.entries(files)) await writeFile(out(p), svg);

await writeFile(out('brand/mark.png'), await png(files['brand/mark.svg'], 1024));
await writeFile(out('brand/logo-horizontal.png'), await png(files['brand/logo-horizontal.svg'], 2120));
await writeFile(out('brand/logo-stacked.png'), await png(files['brand/logo-stacked.svg'], 1800));
await writeFile(out('brand/facebook-profile.png'), await png(await avatar(), 1080));

// Favicons: cream hanger on a charcoal tile, readable down to 16 px.
const tile = (r) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 76 76"><rect x="-6" y="-6" width="76" height="76" rx="${r}" fill="${C.charcoal}"/>${markBody(C.cream)}</svg>`;
await writeFile(out('favicon.svg'), tile(14));
await writeFile(out('favicon-32.png'), await png(tile(14), 32));
await writeFile(out('apple-touch-icon.png'), await png(tile(0), 180));
await writeFile(out('icon-192.png'), await png(tile(0), 192));
await writeFile(out('icon-512.png'), await png(tile(0), 512));

console.log('Brand files written to public/brand/ and favicons to public/.');
