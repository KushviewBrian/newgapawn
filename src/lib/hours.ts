/**
 * Store-hours logic shared by the build (banner, schema, hours table) and the
 * browser (Open/Closed badge, today's row). All times are shop-local Eastern.
 */

export const TIME_ZONE = 'America/New_York';

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_NAMES: Record<DayKey, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

/** Monday-first order for display; Sunday last, as customers expect. */
export const DISPLAY_ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** "HH:MM" 24-hour strings, or null when closed. */
export type Span = { opens: string; closes: string } | null;

export interface Closure {
  /** YYYY-MM-DD, inclusive. */
  start: string;
  end: string;
  reason: string;
  /** Special hours instead of closed all day. */
  opens?: string | null;
  closes?: string | null;
}

export interface HoursData {
  hours: Record<DayKey, Span>;
  closures: Closure[];
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(hhmm: string, { compact = false } = {}): string {
  const mins = toMinutes(hhmm);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h24 >= 12 && h24 < 24 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  if (compact && m === 0) return `${h12} ${suffix}`;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatSpan(span: Span, opts?: { compact?: boolean }): string {
  if (!span) return 'Closed';
  return `${formatTime(span.opens, opts)} – ${formatTime(span.closes, opts)}`;
}

/** Calendar parts of `date` in Eastern Time. */
export function easternParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = get('weekday').toLowerCase().slice(0, 3) as DayKey;
  return {
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
    dayIndex: DAY_KEYS.indexOf(weekday),
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** Add whole days to a YYYY-MM-DD string (calendar math, no time zones). */
export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(ymd: string): DayKey {
  return DAY_KEYS[new Date(`${ymd}T12:00:00Z`).getUTCDay()];
}

export function closureOn(data: HoursData, ymd: string): Closure | undefined {
  return data.closures.find((c) => ymd >= c.start && ymd <= c.end);
}

/** The hours that actually apply on a date, with any closure applied. */
export function spanOn(data: HoursData, ymd: string): { span: Span; closure?: Closure } {
  const closure = closureOn(data, ymd);
  if (closure) {
    const span = closure.opens && closure.closes ? { opens: closure.opens, closes: closure.closes } : null;
    return { span, closure };
  }
  return { span: data.hours[weekdayOf(ymd)] };
}

export interface Status {
  open: boolean;
  label: string;
  detail?: string;
}

/** "Open now · until 6:00 PM" or "Closed now · opens Tuesday 10:00 AM". */
export function currentStatus(data: HoursData, now: Date = new Date()): Status {
  const { ymd, minutes } = easternParts(now);
  const today = spanOn(data, ymd);

  if (today.span && minutes >= toMinutes(today.span.opens) && minutes < toMinutes(today.span.closes)) {
    return { open: true, label: `Open now · until ${formatTime(today.span.closes)}`, detail: today.closure?.reason };
  }

  // Find the next opening within two weeks.
  for (let i = 0; i < 14; i++) {
    const day = addDays(ymd, i);
    const { span } = spanOn(data, day);
    if (!span) continue;
    if (i === 0 && minutes >= toMinutes(span.opens)) continue;
    const when = i === 0 ? 'today' : i === 1 ? 'tomorrow' : DAY_NAMES[weekdayOf(day)];
    return {
      open: false,
      label: `Closed now · opens ${when} ${formatTime(span.opens)}`,
      detail: today.closure?.reason,
    };
  }
  return { open: false, label: 'Closed now', detail: today.closure?.reason };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(ymd: string, { weekday = true } = {}): string {
  const [, m, d] = ymd.split('-').map(Number);
  const day = DAY_NAMES[weekdayOf(ymd)];
  return `${weekday ? `${day}, ` : ''}${MONTHS[m - 1]} ${d}`;
}

/** Short human description of a closure, e.g. "Closed Thursday, Nov 26 (Thanksgiving Day)". */
export function describeClosure(c: Closure): string {
  const range = c.start === c.end ? formatDate(c.start) : `${formatDate(c.start)} – ${formatDate(c.end)}`;
  const what = c.opens && c.closes ? `Open ${formatTime(c.opens, { compact: true })}–${formatTime(c.closes, { compact: true })}` : 'Closed';
  return `${what} ${range}${c.reason ? ` for ${c.reason}` : ''}.`;
}

/** The first regular opening day after a closure ends, for "back Friday". */
export function reopening(data: HoursData, c: Closure): string | null {
  for (let i = 1; i < 14; i++) {
    const day = addDays(c.end, i);
    const { span } = spanOn(data, day);
    if (span) return `Open again ${DAY_NAMES[weekdayOf(day)]}, ${formatTime(span.opens, { compact: true })}.`;
  }
  return null;
}
