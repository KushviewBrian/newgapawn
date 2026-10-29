/**
 * Build-time shop data (from the Google Sheet via scripts/sync-data.mjs),
 * plus the derived banner and schema.org hours.
 */
import data from '../data/generated/shop.json';
import {
  DAY_KEYS,
  describeClosure,
  easternParts,
  reopening,
  type Closure,
  type HoursData,
  type Span,
  type DayKey,
} from './hours';

export interface Rating {
  value: number;
  count: number;
  source: string;
  url: string | null;
}

export const shop = data as unknown as HoursData & {
  source: 'sheet' | 'defaults' | 'fixtures';
  builtAt: string;
  banner: { message: string; until: string | null } | null;
  rating: Rating | null;
};

export const hoursData: HoursData = { hours: shop.hours, closures: shop.closures };

export interface Banner {
  label: string;
  message: string;
  /** Last day to show it (YYYY-MM-DD), so the browser can hide a stale banner between builds. */
  until: string | null;
  tone: 'notice' | 'closed';
}

/** Owner banner first; otherwise announce a closure starting in the next 10 days. */
export function currentBanner(now = new Date()): Banner | null {
  if (shop.banner) return { label: 'Notice', message: shop.banner.message, until: shop.banner.until, tone: 'notice' };
  const { ymd } = easternParts(now);
  const horizon = new Date(`${ymd}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 10);
  const soon = shop.closures.find((c: Closure) => c.start <= horizon.toISOString().slice(0, 10) && c.end >= ymd);
  if (!soon) return null;
  const back = !soon.opens ? reopening(hoursData, soon) : null;
  return {
    label: soon.opens ? 'Special hours' : 'Holiday hours',
    message: `${describeClosure(soon)}${back ? ` ${back}` : ''}`,
    until: soon.end,
    tone: soon.opens ? 'notice' : 'closed',
  };
}

const SCHEMA_DAY: Record<DayKey, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

/** schema.org OpeningHoursSpecification for regular and special hours. */
export function openingHoursSchema() {
  const regular = DAY_KEYS.filter((d) => shop.hours[d]).map((d) => {
    const span = shop.hours[d] as NonNullable<Span>;
    return {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${SCHEMA_DAY[d]}`,
      opens: span.opens,
      closes: span.closes,
    };
  });
  const special = shop.closures.map((c) => ({
    '@type': 'OpeningHoursSpecification',
    validFrom: c.start,
    validThrough: c.end,
    // schema.org convention: 00:00–00:00 means closed all day.
    opens: c.opens ?? '00:00',
    closes: c.closes ?? '00:00',
  }));
  return { regular, special };
}
