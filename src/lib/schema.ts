/** schema.org JSON-LD builders. */
import { business } from '../data/site';
import { openingHoursSchema } from './shop';

export interface Crumb {
  name: string;
  path: string;
}

export function localBusinessSchema(site: URL) {
  const { regular, special } = openingHoursSchema();
  const id = new URL('/#business', site).href;
  return {
    '@context': 'https://schema.org',
    '@type': 'PawnShop',
    '@id': id,
    name: business.name,
    legalName: business.legalName,
    description: business.description,
    url: site.href,
    telephone: business.phoneE164,
    email: business.email,
    foundingDate: business.founded,
    image: [new URL('/storefront.jpg', site).href, new URL('/og/home.png', site).href],
    logo: new URL('/apple-touch-icon.png', site).href,
    priceRange: '$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address.street,
      addressLocality: business.address.city,
      addressRegion: business.address.region,
      postalCode: business.address.postalCode,
      addressCountry: business.address.country,
    },
    geo: { '@type': 'GeoCoordinates', latitude: business.geo.lat, longitude: business.geo.lng },
    areaServed: ['Dallas, GA', 'Hiram, GA', 'Villa Rica, GA', 'Douglasville, GA', 'Paulding County, GA'].map((name) => ({
      '@type': 'Place',
      name,
    })),
    openingHoursSpecification: regular,
    ...(special.length ? { specialOpeningHoursSpecification: special } : {}),
    sameAs: Object.values(business.links).filter((v): v is string => typeof v === 'string' && v.startsWith('http')),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Services',
      itemListElement: [
        ['Pawn loans', '/pawn-loans/'],
        ['Gold and silver buying', '/sell-gold/'],
        ['Firearm sales and trades', '/firearms/'],
        ['FFL transfers', '/ffl-transfers/'],
      ].map(([name, path]) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name, url: new URL(path, site).href },
      })),
    },
  };
}

export function serviceSchema(site: URL, { name, path, description }: { name: string; path: string; description: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url: new URL(path, site).href,
    serviceType: name,
    areaServed: { '@type': 'AdministrativeArea', name: 'Paulding County, Georgia' },
    provider: { '@id': new URL('/#business', site).href, '@type': 'PawnShop', name: business.name },
  };
}

export function breadcrumbSchema(site: URL, crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'Home', path: '/' }, ...crumbs].map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: new URL(c.path, site).href,
    })),
  };
}

export function articleSchema(site: URL, a: { title: string; description: string; path: string; updated: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    url: new URL(a.path, site).href,
    dateModified: a.updated,
    author: { '@type': 'Organization', name: business.name },
    publisher: { '@id': new URL('/#business', site).href, '@type': 'PawnShop', name: business.name },
  };
}

