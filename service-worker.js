const VERSION = 'matharium-v2.0.0';
const ASSETS = [
  './', './index.html', './data-index.js',
  './icon-192.png', './icon-512.png'
];
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.js'
];
const CDN_FALLBACK = {
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.css':
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.11/katex.min.js':
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js'
};

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(async cache => {
      await cache.addAll(ASSETS);
      // CDN — try primary, fallback to alt
      for (const url of CDN_ASSETS) {
        try {
          await cache.add(url);
        } catch (_) {
          try {
            const alt = CDN_FALLBACK[url];
            if (alt) {
              const resp = await fetch(alt);
              if (resp.ok) await cache.put(url, resp);
            }
          } catch (__) {}
        }
      }
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Message: prefetch all topics
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'PREFETCH_TOPICS') {
    const urls = (e.data.ids || []).map(id => 'data/' + id + '.json');
    caches.open(VERSION).then(cache => {
      urls.forEach(url => {
        cache.match(url).then(cached => {
          if (!cached) fetch(url).then(resp => { if (resp.ok) cache.put(url, resp); }).catch(() => {});
        });
      });
    });
  }
});

// Fetch: stale-while-revalidate for local, cache-first for CDN
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // CDN assets — cache-first
  if (url.hostname !== self.location.hostname) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(VERSION).then(c => c.put(e.request, clone));
          }
          return resp;
        }).catch(() => {
          // Try fallback CDN
          const alt = CDN_FALLBACK[e.request.url];
          return alt ? fetch(alt) : new Response('', {status:503});
        });
      })
    );
    return;
  }

  // Local assets — stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(VERSION).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
