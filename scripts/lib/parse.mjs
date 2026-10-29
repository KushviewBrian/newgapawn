/** Small, dependency-free parsers for the owner's Google Sheet. */

/** RFC 4180 CSV → array of rows (arrays of strings). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** CSV with a header row → objects keyed by lower-cased, trimmed header. Blank rows dropped. */
export function csvObjects(text) {
  const [header = [], ...rows] = parseCsv(text);
  const keys = header.map((h) => h.trim().toLowerCase());
  return rows
    .map((cells, i) => ({
      _row: i + 2,
      ...Object.fromEntries(keys.map((k, j) => [k, (cells[j] ?? '').trim()])),
    }))
    .filter((o) => keys.some((k) => o[k]));
}

/** "10", "10am", "10:30 PM", "18:00", "noon" → "HH:MM". Throws on nonsense. */
export function parseTime(input) {
  const s = String(input).trim().toLowerCase().replace(/\./g, '');
  if (s === 'noon') return '12:00';
  if (s === 'midnight') return '00:00';
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) throw new Error(`"${input}" isn't a time (try 10:00 AM)`);
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = m[3]?.[0];
  if (min > 59 || h > 23 || (ap && (h < 1 || h > 12))) throw new Error(`"${input}" isn't a valid time`);
  if (ap === 'p' && h !== 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  if (!ap && h >= 1 && h <= 7) h += 12; // "6" in a shop's hours means 6 PM
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "2026-11-26", "11/26/2026", "11/26/26", "Nov 26, 2026" → "YYYY-MM-DD". */
export function parseDate(input) {
  const s = String(input).trim();
  let y, m, d;
  let match;
  if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [, y, m, d] = match.map(Number);
  else if ((match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))) {
    [, m, d, y] = match.map(Number);
    if (y < 100) y += 2000;
  } else if ((match = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/i))) {
    m = MONTHS.indexOf(match[1].toLowerCase()) + 1;
    d = Number(match[2]);
    y = Number(match[3]);
  }
  const date = y && m && d ? new Date(Date.UTC(y, m - 1, d)) : null;
  if (!date || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`"${input}" isn't a date (try 11/26/2026)`);
  }
  return date.toISOString().slice(0, 10);
}

export function slugify(text, maxWords = 7) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, maxWords)
    .join('-');
}
