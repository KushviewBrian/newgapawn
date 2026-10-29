/**
 * Reads the owner's Google Sheet (published as CSV) into shop data.
 *
 * Tabs and columns (header row required, any order, case doesn't matter):
 *   Hours     Day | Opens | Closes          blank Opens = closed that day
 *   Closures  Date | Through | Reason | Opens | Closes
 *             blank Through = one day; blank Opens/Closes = closed all day
 *   Banner    Message | Show from | Show until    first active row is shown
 *   Settings  Key | Value     rating, review_count, rating_source, rating_url
 *
 * Any mistake throws with the tab and row, which fails the build so the last
 * good version of the site stays live.
 */
import { csvObjects, parseDate, parseTime } from './parse.mjs';

const DAY_ALIASES = {
  sun: 'sun', sunday: 'sun',
  mon: 'mon', monday: 'mon',
  tue: 'tue', tues: 'tue', tuesday: 'tue',
  wed: 'wed', weds: 'wed', wednesday: 'wed',
  thu: 'thu', thur: 'thu', thurs: 'thu', thursday: 'thu',
  fri: 'fri', friday: 'fri',
  sat: 'sat', saturday: 'sat',
};

export function sheetConfigured(env) {
  return Boolean(env.SHEET_PUB_ID && env.SHEET_GID_HOURS);
}

async function fetchTab(env, gid) {
  if (!gid) return [];
  const url = `https://docs.google.com/spreadsheets/d/e/${env.SHEET_PUB_ID}/pub?gid=${gid}&single=true&output=csv`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheet tab ${gid} returned HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error(`Sheet tab ${gid} isn't published as CSV`);
  return csvObjects(text);
}

export async function readSheet(env, defaults) {
  const [hoursRows, closureRows, bannerRows, settingRows] = await Promise.all([
    fetchTab(env, env.SHEET_GID_HOURS),
    fetchTab(env, env.SHEET_GID_CLOSURES),
    fetchTab(env, env.SHEET_GID_BANNER),
    fetchTab(env, env.SHEET_GID_SETTINGS),
  ]);
  const errors = [];
  const attempt = (tab, row, fn) => {
    try {
      return fn();
    } catch (e) {
      errors.push(`${tab} tab, row ${row}: ${e.message}`);
    }
  };

  // Hours: every day must be present exactly once.
  const hours = {};
  for (const r of hoursRows) {
    attempt('Hours', r._row, () => {
      const day = DAY_ALIASES[(r.day ?? '').toLowerCase().replace(/\./g, '')];
      if (!day) throw new Error(`"${r.day}" isn't a day of the week`);
      if (day in hours) throw new Error(`${r.day} is listed twice`);
      if (!r.opens && !r.closes) return (hours[day] = null);
      if (!r.opens || !r.closes) throw new Error('needs both Opens and Closes, or neither for closed');
      const opens = parseTime(r.opens);
      const closes = parseTime(r.closes);
      if (closes <= opens) throw new Error('Closes must be after Opens');
      hours[day] = { opens, closes };
    });
  }
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
    if (!(day in hours)) errors.push(`Hours tab: no row for ${day}`);
  }

  const closures = [];
  for (const r of closureRows) {
    attempt('Closures', r._row, () => {
      const start = parseDate(r.date);
      const end = r.through ? parseDate(r.through) : start;
      if (end < start) throw new Error('Through is before Date');
      const c = { start, end, reason: r.reason ?? '' };
      if (r.opens || r.closes) {
        if (!r.opens || !r.closes) throw new Error('special hours need both Opens and Closes');
        c.opens = parseTime(r.opens);
        c.closes = parseTime(r.closes);
      }
      closures.push(c);
    });
  }
  closures.sort((a, b) => a.start.localeCompare(b.start));

  const banners = [];
  for (const r of bannerRows) {
    attempt('Banner', r._row, () => {
      if (!r.message) return;
      banners.push({
        message: r.message,
        from: r['show from'] ? parseDate(r['show from']) : null,
        until: r['show until'] ? parseDate(r['show until']) : null,
      });
    });
  }

  const settings = Object.fromEntries(settingRows.map((r) => [(r.key ?? '').toLowerCase().replace(/\s+/g, '_'), r.value]));
  let rating = defaults.rating;
  if (settings.rating) {
    attempt('Settings', 'rating', () => {
      const value = Number(settings.rating);
      const count = Number(settings.review_count);
      if (!(value > 0 && value <= 5)) throw new Error(`rating "${settings.rating}" must be between 1 and 5`);
      if (!(count > 0)) throw new Error(`review_count "${settings.review_count}" must be a number`);
      rating = { value, count, source: settings.rating_source || 'Google', url: settings.rating_url || null };
    });
  }

  if (errors.length) {
    const err = new Error(`The Google Sheet has ${errors.length} problem(s):\n  - ${errors.join('\n  - ')}`);
    err.sheetErrors = errors;
    throw err;
  }
  return { hours, closures, banners, rating };
}
