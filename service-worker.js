const CACHE='brandon-fitness-v4-3-recovery';
const ASSETS=[
  './',
  'index.html',
  'styles.css?v=4.0.3-recovery',
  'app.js?v=4.0.3-recovery',
  'manifest.json',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'README.md'
];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

// Network-first for HTML and versioned app assets.
// This preserves offline use but aggressively prefers the newest deployed code.
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;

  const url = new URL(e.request.url);
  const isAppAsset =
    url.pathname.endsWith('/app.js') ||
    url.pathname.endsWith('/styles.css') ||
    e.request.mode === 'navigate';

  if(isAppAsset){
    e.respondWith(
      fetch(e.request, {cache:'no-store'})
        .then(r=>{
          const copy=r.clone();
          caches.open(CACHE).then(c=>c.put(e.request,copy));
          return r;
        })
        .catch(()=>caches.match(e.request).then(r=>r||caches.match('./')))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(r=>{
        const copy=r.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
        return r;
      })
      .catch(()=>caches.match(e.request).then(r=>r||caches.match('./')))
  );
});
