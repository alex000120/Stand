/* Service worker · IA Holográfica
   - La app (html/css/js) se abre al instante desde el celular y se actualiza sola por detrás cuando hay internet.
   - Los videos y el detector (MediaPipe) se guardan con el botón de ⚙️ Configurar
     y se sirven siempre desde el celular: sin esperas ni cortes de red.
   Cada vez que cambies archivos de la app, subí el número de VERSION. */
'use strict';
const VERSION = 'v5';
const SHELL = 'holo-shell-' + VERSION;
const MEDIA = 'holo-media-v1';   // mismo nombre que MEDIA_CACHE en app.js
const SHELL_FILES = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest',
                     './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.all(SHELL_FILES.map(async f => {
      try { const r = await fetch(f, { cache: 'reload' }); if (r.ok) await c.put(f, r); } catch (_) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('holo-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const propio = url.origin === location.origin;
  const mpCdn = (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/@mediapipe/')) ||
                (url.hostname === 'storage.googleapis.com' && url.pathname.includes('/mediapipe-models/'));
  if (!propio && !mpCdn) return;

  if (propio && /\.(mp4|webm|m4v|mov)$/i.test(url.pathname)) { e.respondWith(servirVideo(req)); return; }
  if (mpCdn || url.pathname.includes('/mediapipe/')) { e.respondWith(cacheFirst(req)); return; }
  e.respondWith(rapido(req, e));
});

/* Archivos del detector: si están guardados, se usan; si no, se piden y se guardan. */
async function cacheFirst(req) {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.status === 200) { try { await cache.put(req.url, res.clone()); } catch (_) {} }
  return res;
}

/* Videos: si están guardados los servimos nosotros (incluye pedidos "Range" que usa <video>). */
async function servirVideo(req) {
  const cache = await caches.open(MEDIA);
  const hit = await cache.match(req.url);
  if (!hit) return fetch(req);
  const range = req.headers.get('range');
  if (!range) return hit;
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return hit;
  const blob = await hit.blob(), size = blob.size;
  let start, end;
  if (m[1] === '' && m[2] !== '') { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  else { start = parseInt(m[1] || '0', 10); end = m[2] === '' ? size - 1 : Math.min(parseInt(m[2], 10), size - 1); }
  if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': hit.headers.get('Content-Type') || 'video/mp4',
      'Content-Length': String(end - start + 1),
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Accept-Ranges': 'bytes'
    }
  });
}

/* La app: se abre al instante con lo guardado y se actualiza por detrás (la versión nueva se ve
   en la siguiente apertura). Sin nada guardado, se pide a la red. */
async function rapido(req, e) {
  const cache = await caches.open(SHELL);
  const guardado = await cache.match(req, { ignoreSearch: true });
  const red = fetch(req.url, { cache: 'no-cache' }).then(res => {
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  });
  if (guardado) { e.waitUntil(red.catch(() => {})); return guardado; }
  try { return await red; }
  catch (_) {
    if (req.mode === 'navigate') { const i = await cache.match('./index.html'); if (i) return i; }
    return Response.error();
  }
}
