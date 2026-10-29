/**
 * Site-wide behavior, kept tiny:
 *  - Directions links open Apple Maps on Apple devices, Google Maps elsewhere.
 *  - Clicks on [data-track] elements are counted by the shop-api Worker.
 */
const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
if (isApple) {
  document.querySelectorAll<HTMLAnchorElement>('a[data-directions]').forEach((a) => (a.href = a.dataset.directions!));
}

document.addEventListener(
  'click',
  (event) => {
    const el = (event.target as Element | null)?.closest<HTMLElement>('[data-track]');
    if (!el) return;
    const body = JSON.stringify({
      event: el.dataset.track,
      where: el.dataset.trackWhere ?? null,
      page: location.pathname,
    });
    try {
      navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }));
    } catch {
      /* Tracking must never get in the way of a call. */
    }
  },
  { capture: true },
);
