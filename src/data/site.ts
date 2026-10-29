/**
 * Business facts used across the site. Anything marked `confirmed: false`
 * (or listed in `unconfirmed`) still needs the owner's sign-off; run
 * `npm run launch-check` to see what's outstanding before launch.
 */

export const business = {
  name: 'New Georgia Pawn',
  legalName: 'New Georgia Pawn Shop LLC',
  tagline: 'Pawn · Gold & Silver · Firearms',
  description:
    'Locally owned pawn shop on Villa Rica Highway in Dallas, GA. Pawn loans, gold and silver buying, firearms sales and trades, and FFL transfers.',
  founded: '2024-10-01',
  phone: '(770) 443-0328',
  phoneE164: '+17704430328',
  /** Set to true once the owner confirms the shop line can receive texts. */
  textEnabled: false,
  email: 'newgeorgiapawn@gmail.com',
  address: {
    street: '7029 Villa Rica Hwy',
    city: 'Dallas',
    region: 'GA',
    postalCode: '30157',
    country: 'US',
    county: 'Paulding County',
  },
  /** US Census geocoder match; confirm against the owner's Google Maps pin. */
  geo: { lat: 33.820852, lng: -84.879857 },
  ffl: {
    number: '1-58-223-02-7J-23834',
    type: 'Type 02 · Pawnbroker',
    licenseName: 'New Georgia Pawn Shop LLC',
  },
  /** Exact wording comes from the Paulding County pawnbroker license. */
  licenseLine: 'Licensed pawnbroker and federal firearms licensee',
  /** null = "call for the current fee" until the owner gives a number. */
  fflTransferFee: null as string | null,
  fflTurnaround: null as string | null,
  links: {
    facebook: 'https://www.facebook.com/p/New-Georgia-Pawn-Shop-61567233179620/',
    gunmade: 'https://www.gunmade.com/stores/georgia/dallas/new-georgia-pawn-shop-17445/',
    buya: 'https://www.buya.com/StoreProfile/About/NEW-GEORGIA-PAWN-SHOP/3494',
    masterffl: 'https://masterffl.com/ffl-dealers/new-georgia-pawn-shop-dallas-ga-216484138/',
    /** Google Business Profile place ID, used for the /review short link. */
    googlePlaceId: null as string | null,
  },
} as const;

export const fullAddress = `${business.address.street}, ${business.address.city}, ${business.address.region} ${business.address.postalCode}`;

export const mapsLinks = {
  google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${business.legalName}, ${fullAddress}`)}`,
  apple: `https://maps.apple.com/?daddr=${encodeURIComponent(fullAddress)}&q=${encodeURIComponent(business.name)}`,
};

export const reviewUrl = business.links.googlePlaceId
  ? `https://search.google.com/local/writereview?placeid=${business.links.googlePlaceId}`
  : null;

export const nav = [
  { href: '/pawn-loans/', label: 'Pawn Loans' },
  { href: '/sell-gold/', label: 'Sell Gold' },
  { href: '/firearms/', label: 'Firearms' },
  { href: '/ffl-transfers/', label: 'FFL Transfers' },
  { href: '/about/', label: 'About' },
  { href: '/visit/', label: 'Visit' },
] as const;

export const services = [
  {
    key: 'pawn',
    title: 'Pawn Loans',
    href: '/pawn-loans/',
    icon: 'cash',
    blurb: 'Short- or long-term cash on the things you own. No credit check. Pick your item back up when you repay.',
    cta: 'How pawning works',
  },
  {
    key: 'gold',
    title: 'We Buy Gold & Silver',
    href: '/sell-gold/',
    icon: 'gold',
    blurb: 'Jewelry, coins, bullion and scrap, tested and weighed in front of you. Cash paid on the spot.',
    cta: 'What we buy',
  },
  {
    key: 'firearms',
    title: 'Firearms',
    href: '/firearms/',
    icon: 'shield',
    blurb: 'Buy, sell, or trade handguns, rifles and shotguns. We take trades for guns, gold and silver.',
    cta: "See what's in the case",
  },
  {
    key: 'ffl',
    title: 'FFL Transfers',
    href: '/ffl-transfers/',
    icon: 'package',
    blurb: 'Bought a gun online or from a private seller? Ship it here. We call when it arrives.',
    cta: 'Transfer steps and fee',
  },
] as const;

/**
 * Owner-approved review quotes. Leave empty until the owner approves them;
 * the reviews section adapts. Example:
 * { quote: 'Fair price and fast.', name: 'Dana', source: 'Google' }
 */
export const reviews: { quote: string; name: string; source: string }[] = [];

/** Facts in the copy that still need the owner's confirmation. */
export const unconfirmed = [
  'Weekly hours (defaults are the Gun Made listing)',
  'Map pin coordinates (US Census geocoder match)',
  'Pawnbroker license wording (Paulding County)',
  'FFL transfer fee and turnaround',
  'Gold buying: tested (acid or electronic) and weighed on a certified scale in front of the customer, no appointment needed',
  'Item categories listed on the Pawn Loans page',
  'Firearms: trades accepted for gold, silver, or guns',
  'Georgia Weapons Carry License as a NICS alternative (check ATF permit chart)',
  'Store policies: returns, holds, layaway, warranties',
  'Text-capable phone line',
  'Offer reply time ("usually the same business day")',
  'FFL: arrival call the same day, private-party transfers, pickup/hold policy',
  'About page story (written ahead of the owner interview)',
  'Driving directions on the Visit page',
];
