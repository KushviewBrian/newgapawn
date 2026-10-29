export const guides = [
  {
    slug: 'how-pawn-loans-work-in-georgia',
    title: 'How pawn loans work in Georgia',
    description:
      'A plain-English guide to pawn loans in Georgia: what you bring, what the pawn ticket tells you, how to repay or extend, and what happens if you don’t.',
    updated: '2026-10-29',
    readTime: '5 min read',
    service: { label: 'Pawn Loans', href: '/pawn-loans/' },
  },
  {
    slug: 'how-gold-is-priced-when-you-sell',
    title: 'How gold is priced when you sell',
    description:
      'Karats, troy ounces, pennyweights, and the daily spot price: how a gold buyer works out what your jewelry or coins are worth, with a worked example.',
    updated: '2026-10-29',
    readTime: '6 min read',
    service: { label: 'Sell Gold & Silver', href: '/sell-gold/' },
  },
  {
    slug: 'what-to-bring-for-an-ffl-transfer',
    title: 'What to bring for an FFL transfer',
    description:
      'Your checklist for picking up a gun bought online or from a private seller: ID, the Form 4473, the background check, age rules, and timing.',
    updated: '2026-10-29',
    readTime: '4 min read',
    service: { label: 'FFL Transfers', href: '/ffl-transfers/' },
  },
] as const;

export type Guide = (typeof guides)[number];
