# Map data

`osm-roads.json` is an OpenStreetMap extract (© OpenStreetMap contributors, ODbL)
of the roads and water around the shop. `npm run map` turns it into
`src/data/map.json`, which the site's static map draws.

To refresh it, post this query to an Overpass API server (for example
https://overpass-api.de/api/interpreter) and save the JSON response here:

```
[out:json][timeout:60];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"](33.806,-84.900,33.836,-84.860);
  way["natural"="water"](33.806,-84.900,33.836,-84.860);
);
out geom tags;
```

If the shop's map pin moves, update `SHOP` in `scripts/render-map.mjs` and
`business.geo` in `src/data/site.ts`, then re-run `npm run map`.
