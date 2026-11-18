/* Alicerce — sw.js
 * Service Worker offline-first.
 * - Pré-cacheia todo o App Shell na instalação (Cache API).
 * - Navegações: responde com o index.html em cache (instantâneo e 100% offline) e atualiza em segundo plano.
 * - Demais arquivos do mesmo domínio: stale-while-revalidate.
 * IMPORTANTE: ao publicar uma nova versão dos arquivos, incremente CACHE_VERSION.
 */
var CACHE_VERSION = 'v1.15.0';
var CACHE_NAME = 'alicerce-' + CACHE_VERSION;

var SHELL = [
  './',
  './index.html',
  './style.css',
  './themes.css',
  './app.js',
  './canvas-engine.js',
  './storage.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

var INDEX_URL = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Cada arquivo é adicionado individualmente: uma falha isolada não impede a instalação.
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function (err) {
          console.warn('[Alicerce SW] Não foi possível pré-cachear', url, err);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys
        .filter(function (k) { return k.indexOf('alicerce-') === 0 && k !== CACHE_NAME; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(event));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});

function handleNavigate(event) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(INDEX_URL, { ignoreSearch: true }).then(function (shell) {
      var network = fetch(event.request).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          cache.put(INDEX_URL, res.clone());
        }
        return res;
      }).catch(function () { return null; });

      if (shell) {
        event.waitUntil(network);
        return shell;
      }
      return network.then(function (res) {
        return res || new Response('Alicerce está offline e o app ainda não foi armazenado em cache.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    });
  });
}

function staleWhileRevalidate(event) {
  var req = event.request;
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      }).catch(function () { return null; });

      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network.then(function (res) { return res || Response.error(); });
    });
  });
}
