#!/usr/bin/env node
/**
 * Turns the saved OpenStreetMap extract (scripts/data/osm-roads.json) into
 * simplified SVG path data for the site's static map (src/data/map.json).
 *
 * Run once, or whenever the area data is refreshed:
 *   npm run map
 *
 * To refresh the extract, re-run the Overpass query in scripts/data/README.md.
 * Map data © OpenStreetMap contributors, ODbL. The site credits it on the map.
 */
import { readFile, writeFile } from 'node:fs/promises';

const SHOP = { lat: 33.820852, lng: -84.879857 };
/** Output window; the site shows a 720 × 480 view centred on the pin. */
const WIDTH = 760;
const HEIGHT = 520;
/** Pixels per degree of longitude; latitude is scaled by cos(lat). */
const SCALE = 26000;

const osm = JSON.parse(await readFile(new URL('./data/osm-roads.json', import.meta.url), 'utf8'));
const kx = SCALE * Math.cos((SHOP.lat * Math.PI) / 180);
const ky = SCALE;

function project({ lat, lon }) {
  return [WIDTH / 2 + (lon - SHOP.lng) * kx, HEIGHT / 2 - (lat - SHOP.lat) * ky];
}

/** Drop points closer than `tol` px to the last kept point. */
function simplify(points, tol = 3) {
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [lx, ly] = out[out.length - 1];
    if (Math.hypot(x - lx, y - ly) >= tol) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

const r = (n) => Math.round(n);
const toPath = (pts, close = false) =>
  'M' + pts.map(([x, y]) => `${r(x)} ${r(y)}`).join('L') + (close ? 'Z' : '');

const pad = 10;
const inView = (pts) => pts.some(([x, y]) => x > -pad && x < WIDTH + pad && y > -pad && y < HEIGHT + pad);

const roadClass = {
  motorway: 'major',
  trunk: 'major',
  primary: 'major',
  secondary: 'minor',
  tertiary: 'minor',
  unclassified: 'local',
  residential: 'local',
};

const roads = { major: [], minor: [], local: [] };
const water = [];
/** Longest drawn run per named road, for its label. */
const named = new Map();

for (const el of osm.elements) {
  if (!el.geometry) continue;
  const pts = simplify(el.geometry.map(project));
  if (pts.length < 2 || !inView(pts)) continue;

  if (el.tags.natural === 'water') {
    water.push(toPath(pts, true));
    continue;
  }
  const cls = roadClass[el.tags.highway];
  if (!cls) continue;
  roads[cls].push(toPath(pts));

  const name = el.tags.name;
  if (name && cls !== 'local') {
    const visible = pts.filter(([x, y]) => x > 40 && x < WIDTH - 40 && y > 40 && y < HEIGHT - 40);
    let len = 0;
    for (let i = 1; i < visible.length; i++) len += Math.hypot(visible[i][0] - visible[i - 1][0], visible[i][1] - visible[i - 1][1]);
    const prev = named.get(name);
    if (visible.length > 1 && (!prev || len > prev.len)) {
      // Keep label paths reading left-to-right.
      const run = visible[0][0] > visible[visible.length - 1][0] ? [...visible].reverse() : visible;
      named.set(name, { len, d: toPath(run), cls, ref: el.tags.ref ?? null });
    }
  }
}

const labels = [...named.entries()]
  .filter(([, v]) => v.len > 140)
  .sort((a, b) => (a[1].cls === b[1].cls ? b[1].len - a[1].len : a[1].cls === 'major' ? -1 : 1))
  .slice(0, 6)
  .map(([name, v], i) => ({
    id: `lbl-${i}`,
    text: v.ref ? `${name} · ${v.ref.replace('GA ', 'GA-')}` : name,
    d: v.d,
    cls: v.cls,
  }));

const out = {
  attribution: 'Map data © OpenStreetMap contributors',
  width: WIDTH,
  height: HEIGHT,
  pin: project({ lat: SHOP.lat, lon: SHOP.lng }).map(r),
  water,
  roads,
  labels,
};

await writeFile(new URL('../src/data/map.json', import.meta.url), JSON.stringify(out));
const size = JSON.stringify(out).length;
console.log(`map.json written: ${roads.major.length} major, ${roads.minor.length} minor, ${roads.local.length} local roads, ${labels.length} labels, ${(size / 1024).toFixed(1)} KB`);
