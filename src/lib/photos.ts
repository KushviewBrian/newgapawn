/**
 * Shop photos from the on-site session. Drop files into src/assets/photos/
 * using these names and the pages pick them up; until then, layouts that
 * would show them use designed, photo-free versions instead.
 *
 *   storefront   Home hero (3:2)
 *   counter      Pawn Loans (3:2)
 *   gold         We Buy Gold & Silver hero (portrait)
 *   silver       We Buy Gold & Silver, what to bring (portrait)
 *   gun-wall     Firearms (3:2)
 *   owner        About (4:5)
 */
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../assets/photos/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
});

export type PhotoName = 'storefront' | 'counter' | 'gold' | 'silver' | 'gun-wall' | 'owner';

export function getPhoto(name: PhotoName): ImageMetadata | undefined {
  const entry = Object.entries(files).find(([path]) => path.split('/').pop()!.replace(/\.\w+$/, '') === name);
  return entry?.[1].default;
}

export const photoAlt: Record<PhotoName, string> = {
  storefront: 'The New Georgia Pawn Shop storefront on Villa Rica Highway in Dallas, GA: a gray metal building with a stone base and the shop sign over the door',
  counter: 'The front counter at New Georgia Pawn',
  gold: 'A pile of gold rings, chains, bracelets, and pendants on the counter at New Georgia Pawn',
  silver: 'Silver bullion bars and coins, including ten-ounce .999 fine silver bars, on the counter at New Georgia Pawn',
  'gun-wall': 'Rifles and shotguns on the wall at New Georgia Pawn',
  owner: 'The owner of New Georgia Pawn behind the counter',
};
