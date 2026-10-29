/**
 * Shop photos. Drop files into src/assets/photos/ using these names and the
 * pages pick them up; until then, layouts that would show them use designed,
 * photo-free versions instead.
 *
 *   storefront   Home hero, Visit (3:2)
 *   jewelry      Pawn Loans hero (4:3)
 *   shop-floor   Pawn Loans, what we loan on (wide)
 *   tools        Home gallery (4:3)
 *   guitars      Home gallery (4:3)
 *   gold         We Buy Gold & Silver hero, Home gallery (portrait)
 *   silver       We Buy Gold & Silver, what to bring (portrait)
 *   rifles       Firearms hero, Home gallery (portrait)
 *   gun-wall     Firearms, federal rules section (portrait)
 *   owner        About (4:5)
 */
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
});

export type PhotoName = 'storefront' | 'jewelry' | 'shop-floor' | 'tools' | 'guitars' | 'gold' | 'silver' | 'rifles' | 'gun-wall' | 'owner';

export function getPhoto(name: PhotoName): ImageMetadata | undefined {
  const entry = Object.entries(files).find(([path]) => path.split('/').pop()!.replace(/\.\w+$/, '') === name);
  return entry?.[1].default;
}

export const photoAlt: Record<PhotoName, string> = {
  storefront: 'The New Georgia Pawn Shop storefront on Villa Rica Highway in Dallas, GA: a gray metal building with a stone base and the shop sign over the door',
  jewelry: 'Glass display case of gold and silver rings, earrings, pendants, and chains at New Georgia Pawn',
  'shop-floor': 'The shop floor at New Georgia Pawn with a portable generator, shop vacuum, ladders, power tools, and a wall of holsters and accessories',
  tools: 'A set of Ridgid cordless power tools with a battery and charger for sale at New Georgia Pawn',
  guitars: 'A wall of acoustic and electric guitars for sale at New Georgia Pawn',
  gold: 'A pile of gold rings, chains, bracelets, and pendants on the counter at New Georgia Pawn',
  silver: 'Silver bullion bars and coins, including ten-ounce .999 fine silver bars, on the counter at New Georgia Pawn',
  rifles: 'Youth rifles with pink, laminate, and blue stocks, a tan scoped rifle on a bipod, and a flag-painted rifle at New Georgia Pawn',
  'gun-wall': 'AR-style pistols and a folding carbine hanging on the gun wall with price tags at New Georgia Pawn',
  owner: 'The owner of New Georgia Pawn behind the counter',
};
