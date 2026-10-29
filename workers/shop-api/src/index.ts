/**
 * shop-api Worker, routed at <domain>/api/*.
 *
 *   POST /api/offer    Get an Offer form → Turnstile check → email to the shop
 *   POST /api/track    click counts (call, directions, offer) → D1 daily totals
 *   GET  /api/publish  owner's "Publish now" link → rebuild the site
 *   cron 0 *\/3 * * *  rebuild (fresh Sheet data) + closure reminders
 *   cron 0 13 1 * *    monthly click summary to the shop
 */
import { EmailMessage } from 'cloudflare:email';
import { buildMime, escapeHtml, type Attachment } from './mime';
import { parseCsv } from '../../../scripts/lib/parse.mjs';

export interface Env {
  DB: D1Database;
  MAIL: SendEmail;
  SITE_URL: string;
  MAIL_FROM: string;
  SHOP_TO: string;
  DEV_TO: string;
  SHEET_PUB_ID: string;
  SHEET_GID_CLOSURES: string;
  TURNSTILE_SECRET: string;
  DEPLOY_HOOK_URL: string;
  PUBLISH_KEY: string;
}

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024; // stays under the 25 MiB email limit after base64
const PUBLISH_COOLDOWN_S = 120;
const TRACK_EVENTS = new Set(['call', 'text', 'directions', 'offer-cta', 'review', 'facebook', 'email']);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function easternDay(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date);
}

async function sendMail(env: Env, to: string, subject: string, text: string, html: string, extra: { replyTo?: string; attachments?: Attachment[] } = {}) {
  const raw = buildMime({ from: { name: 'New Georgia Pawn Website', address: env.MAIL_FROM }, to, subject, text, html, ...extra });
  await env.MAIL.send(new EmailMessage(env.MAIL_FROM, to, raw));
}

async function alertDev(env: Env, subject: string, detail: string) {
  if (!env.DEV_TO) return console.error(subject, detail);
  await sendMail(env, env.DEV_TO, `[newgapawn] ${subject}`, detail, `<pre>${escapeHtml(detail)}</pre>`).catch((e) =>
    console.error('alert failed', e),
  );
}

/* ---------------------------------------------------------------- offer */

const LABELS: Record<string, string> = {
  intent: 'Wants to',
  itemType: 'Item',
  brandModel: 'Brand and model',
  condition: 'Condition',
  details: 'Details',
  name: 'Name',
  phone: 'Phone',
  contact: 'Reply by',
  email: 'Email',
};
const INTENT: Record<string, string> = { pawn: 'Pawn it', sell: 'Sell it', unsure: 'Not sure yet' };

async function verifyTurnstile(env: Env, token: string, ip: string | null): Promise<boolean> {
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const out = (await res.json()) as { success: boolean };
  return out.success;
}

async function handleOffer(request: Request, env: Env): Promise<Response> {
  const wantsJson = (request.headers.get('Accept') ?? '').includes('application/json');
  const fail = (error: string, status = 400) =>
    wantsJson ? json({ ok: false, error }, status) : Response.redirect(new URL('/get-an-offer/?error=1', env.SITE_URL).href, 303);

  if (Number(request.headers.get('Content-Length') ?? 0) > MAX_TOTAL_BYTES + 200_000) {
    return fail('Those photos are too large. Try fewer or smaller photos.', 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('We couldn’t read that form.');
  }

  // Honeypot: bots fill every field. Pretend it worked.
  if (String(form.get('website') ?? '')) return wantsJson ? json({ ok: true }) : Response.redirect(new URL('/offer-sent/', env.SITE_URL).href, 303);

  const token = String(form.get('cf-turnstile-response') ?? '');
  if (!token || !(await verifyTurnstile(env, token, request.headers.get('CF-Connecting-IP')))) {
    return fail('The spam check didn’t pass. Please try again.', 403);
  }

  const field = (k: string, max: number) => String(form.get(k) ?? '').trim().slice(0, max);
  const data: Record<string, string> = {
    intent: INTENT[field('intent', 10)] ?? '',
    itemType: field('itemType', 80),
    brandModel: field('brandModel', 160),
    condition: field('condition', 40),
    details: field('details', 2000),
    name: field('name', 80),
    phone: field('phone', 20),
    contact: field('contact', 10) === 'text' ? 'Text' : 'Call',
    email: field('email', 120),
  };
  for (const k of ['intent', 'itemType', 'brandModel', 'condition', 'name', 'phone']) {
    if (!data[k]) return fail('Please fill in all the required fields.');
  }
  if (data.phone.replace(/\D/g, '').length < 10) return fail('Please enter a 10-digit phone number.');
  if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) data.email = '';

  const attachments: Attachment[] = [];
  let total = 0;
  for (const entry of form.getAll('photos').slice(0, MAX_PHOTOS)) {
    if (!(entry instanceof File) || !entry.size) continue;
    if (!entry.type.startsWith('image/')) return fail('Photos must be images.');
    if (entry.size > MAX_PHOTO_BYTES) return fail('One of the photos is too large.', 413);
    total += entry.size;
    if (total > MAX_TOTAL_BYTES) return fail('Those photos are too large together. Try fewer photos.', 413);
    attachments.push({ filename: entry.name, contentType: entry.type, data: await entry.arrayBuffer() });
  }

  const subject = `Offer request: ${data.intent} · ${data.itemType} · ${data.brandModel}`.slice(0, 150);
  const rows = Object.entries(LABELS)
    .filter(([k]) => data[k])
    .map(([k, label]) => [label, data[k]] as const);
  const text = [
    ...rows.map(([l, v]) => `${l}: ${v}`),
    '',
    `${attachments.length} photo(s) attached.`,
    `Call back: ${data.phone}`,
    '',
    'Sent from the Get an Offer form on the website.',
  ].join('\n');
  const tel = data.phone.replace(/[^\d+]/g, '');
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#1c1c1a;line-height:1.5">
<h2 style="font-family:Georgia,serif;margin:0 0 12px">New offer request</h2>
<table cellpadding="6" style="border-collapse:collapse">${rows
    .map(([l, v]) => `<tr><td style="color:#5f5b52;vertical-align:top">${escapeHtml(l)}</td><td><strong>${escapeHtml(v).replace(/\n/g, '<br>')}</strong></td></tr>`)
    .join('')}</table>
<p><a href="tel:${escapeHtml(tel)}" style="display:inline-block;background:#a8842c;color:#1c1c1a;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">Call ${escapeHtml(data.name)} back</a></p>
<p style="color:#5f5b52;font-size:13px">${attachments.length} photo(s) attached. Sent from the Get an Offer form on the website.</p>
</body></html>`;

  try {
    await sendMail(env, env.SHOP_TO, subject, text, html, { replyTo: data.email || undefined, attachments });
  } catch (e) {
    await alertDev(env, 'Offer email failed', String(e));
    return fail('We couldn’t send that right now.', 502);
  }
  await countClick(env, 'offer-sent', '/get-an-offer/', '').catch(() => {});
  return wantsJson ? json({ ok: true }) : Response.redirect(new URL('/offer-sent/', env.SITE_URL).href, 303);
}

/* ---------------------------------------------------------------- tracking */

async function countClick(env: Env, event: string, page: string, place: string) {
  await env.DB.prepare(
    `INSERT INTO clicks (day, event, page, place, count) VALUES (?1, ?2, ?3, ?4, 1)
     ON CONFLICT (day, event, page, place) DO UPDATE SET count = count + 1`,
  )
    .bind(easternDay(), event, page, place)
    .run();
}

async function handleTrack(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as { event?: string; page?: string; where?: string | null };
    const event = String(body.event ?? '');
    const page = String(body.page ?? '/').slice(0, 120);
    const place = String(body.where ?? '').slice(0, 40);
    if (TRACK_EVENTS.has(event) && page.startsWith('/')) await countClick(env, event, page, place);
  } catch {
    /* ignore malformed beacons */
  }
  return new Response(null, { status: 204 });
}

/* ---------------------------------------------------------------- publish */

function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

async function triggerBuild(env: Env): Promise<boolean> {
  const res = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' });
  return res.ok;
}

const page = (title: string, message: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="font-family:system-ui,sans-serif;background:#faf8f3;color:#1c1c1a;display:grid;place-items:center;min-height:90vh;margin:0;padding:24px;text-align:center">
<div><h1 style="font-family:Georgia,serif;font-weight:600">${title}</h1><p style="font-size:18px;max-width:28em;color:#5f5b52">${message}</p></div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );

async function handlePublish(request: Request, env: Env): Promise<Response> {
  const key = new URL(request.url).searchParams.get('key') ?? '';
  if (!env.PUBLISH_KEY || !safeEqual(key, env.PUBLISH_KEY)) return page('Link not recognized', 'Check that you used the bookmarked Publish now link.', 403);

  const now = Math.floor(Date.now() / 1000);
  const last = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'last_publish'`).first<string>('value');
  if (last && now - Number(last) < PUBLISH_COOLDOWN_S) {
    return page('Already publishing', 'Your changes are on their way. The site updates within a few minutes.');
  }
  await env.DB.prepare(`INSERT INTO meta (key, value) VALUES ('last_publish', ?1) ON CONFLICT (key) DO UPDATE SET value = ?1`)
    .bind(String(now))
    .run();

  if (!(await triggerBuild(env))) {
    await alertDev(env, 'Publish now failed', 'The deploy hook returned an error.');
    return page('Something went wrong', 'The site couldn’t start updating. The developer has been notified.', 502);
  }
  return page('Publishing your changes', 'The website will show your Sheet edits within a few minutes. You can close this page.');
}

/* ---------------------------------------------------------------- scheduled */

/** Emails the shop once per new closure: set the same special hours on Google. */
async function closureReminders(env: Env) {
  if (!env.SHEET_PUB_ID || !env.SHEET_GID_CLOSURES) return;
  const url = `https://docs.google.com/spreadsheets/d/e/${env.SHEET_PUB_ID}/pub?gid=${env.SHEET_GID_CLOSURES}&single=true&output=csv`;
  const res = await fetch(url);
  if (!res.ok) return;
  const [header = [], ...rows] = parseCsv(await res.text());
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const [iDate, iThrough, iReason] = [col('date'), col('through'), col('reason')];
  for (const r of rows) {
    const date = r[iDate]?.trim();
    if (!date) continue;
    const id = `${date}|${r[iThrough] ?? ''}|${r[iReason] ?? ''}`;
    const seen = await env.DB.prepare('SELECT 1 FROM closure_reminders WHERE closure = ?1').bind(id).first();
    if (seen) continue;
    const when = r[iThrough] ? `${date} through ${r[iThrough]}` : date;
    const text = `You added a closure to the website: ${when}${r[iReason] ? ` (${r[iReason]})` : ''}.

The website banner and hours update automatically. Google Maps does not.
Please set the same special hours on Google:

1. Open the Google Maps app or business.google.com
2. Edit profile > Hours > Special hours
3. Add ${when} and mark it Closed (or enter the special hours)

This keeps Google from sending customers on a closed day.`;
    await sendMail(env, env.SHOP_TO, `Reminder: add ${when} to your Google hours`, text, `<pre style="font-family:Arial,sans-serif;font-size:15px;white-space:pre-wrap">${escapeHtml(text)}</pre>`);
    await env.DB.prepare('INSERT INTO closure_reminders (closure, sent_at) VALUES (?1, ?2)').bind(id, new Date().toISOString()).run();
  }
}

async function monthlySummary(env: Env) {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const start = first.toISOString().slice(0, 10);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10);
  const month = first.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const { results: totals } = await env.DB.prepare(
    'SELECT event, SUM(count) AS n FROM clicks WHERE day BETWEEN ?1 AND ?2 GROUP BY event ORDER BY n DESC',
  )
    .bind(start, end)
    .all<{ event: string; n: number }>();
  const { results: pages } = await env.DB.prepare(
    `SELECT page, SUM(count) AS n FROM clicks WHERE day BETWEEN ?1 AND ?2 AND event IN ('call','offer-sent') GROUP BY page ORDER BY n DESC LIMIT 5`,
  )
    .bind(start, end)
    .all<{ page: string; n: number }>();

  const names: Record<string, string> = {
    call: 'Call button taps',
    text: 'Text button taps',
    directions: 'Directions taps',
    'offer-cta': 'Get an Offer clicks',
    'offer-sent': 'Offer requests sent',
    review: 'Review link clicks',
    facebook: 'Facebook clicks',
    email: 'Email clicks',
  };
  const lines = totals.length ? totals.map((t) => `${names[t.event] ?? t.event}: ${t.n}`) : ['No clicks recorded this month.'];
  const top = pages.map((p) => `${p.page}: ${p.n}`);
  const text = `Website summary for ${month}\n\n${lines.join('\n')}\n\nPages that led to the most calls and offer requests:\n${top.join('\n') || '(none yet)'}\n\nVisitor counts are in Cloudflare Web Analytics.`;
  await sendMail(env, env.SHOP_TO, `Your website in ${month}`, text, `<pre style="font-family:Arial,sans-serif;font-size:15px;white-space:pre-wrap">${escapeHtml(text)}</pre>`);
}

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/offer' && request.method === 'POST') return handleOffer(request, env);
    if (pathname === '/api/track' && request.method === 'POST') return handleTrack(request, env);
    if (pathname === '/api/publish' && request.method === 'GET') return handlePublish(request, env);
    return json({ ok: false, error: 'Not found' }, 404);
  },

  async scheduled(event, env, ctx): Promise<void> {
    if (event.cron === '0 13 1 * *') {
      ctx.waitUntil(monthlySummary(env).catch((e) => alertDev(env, 'Monthly summary failed', String(e))));
      return;
    }
    ctx.waitUntil(
      (async () => {
        if (env.DEPLOY_HOOK_URL && !(await triggerBuild(env))) await alertDev(env, 'Scheduled rebuild failed', 'Deploy hook returned an error.');
        await closureReminders(env).catch((e) => alertDev(env, 'Closure reminders failed', String(e)));
      })(),
    );
  },
} satisfies ExportedHandler<Env>;
