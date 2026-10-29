/** Builds a raw MIME message (text + HTML + attachments) for Cloudflare's send_email binding. */

export interface Attachment {
  filename: string;
  contentType: string;
  data: ArrayBuffer;
}

export interface Mail {
  from: { name: string; address: string };
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  attachments?: Attachment[];
}

const CRLF = '\r\n';

function encodeHeader(value: string): string {
  // RFC 2047 for anything outside printable ASCII.
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${b64(new TextEncoder().encode(value))}?=`;
}

function b64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function wrap76(s: string): string {
  return s.replace(/.{1,76}/g, (line) => line + CRLF);
}

function safeName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, '_').slice(0, 80) || 'photo.jpg';
}

export function buildMime(mail: Mail): string {
  const mixed = `mixed_${crypto.randomUUID()}`;
  const alt = `alt_${crypto.randomUUID()}`;
  const text = (s: string) => wrap76(b64(new TextEncoder().encode(s)));

  const headers = [
    `From: ${encodeHeader(mail.from.name)} <${mail.from.address}>`,
    `To: ${mail.to}`,
    ...(mail.replyTo ? [`Reply-To: ${mail.replyTo}`] : []),
    `Subject: ${encodeHeader(mail.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${mail.from.address.split('@')[1]}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
  ];

  const parts = [
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    text(mail.text),
    `--${alt}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    text(mail.html),
    `--${alt}--`,
  ];

  for (const a of mail.attachments ?? []) {
    const name = safeName(a.filename);
    parts.push(
      `--${mixed}`,
      `Content-Type: ${a.contentType}; name="${name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${name}"`,
      '',
      wrap76(b64(new Uint8Array(a.data))),
    );
  }
  parts.push(`--${mixed}--`, '');
  return headers.join(CRLF) + CRLF + CRLF + parts.join(CRLF);
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
