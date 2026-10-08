'use strict';
const CACHE='brandon-fitness-v5-preview-3';
const VERSION='5.0.0-preview.3';
const ROOT=new URL('./',self.location.href);
const APP_HTML=new URL('index.html',ROOT).href;
const RECOVERY_HTML=new URL('recovery.html',ROOT).pathname;
const RECOVERY_VERSION='4.0.4-data-export';
const ASSETS=['./','index.html','styles.css?v='+VERSION,'app.js?v='+VERSION,'v5-config.js?v='+VERSION,'v5-core.js?v='+VERSION,'v5-runtime.js?v='+VERSION,'coach-engine.js?v='+VERSION,'coach-ui.js?v='+VERSION,'manifest.json','icon-192.png','icon-512.png','icon.svg','recovery.html','recovery.js?v='+RECOVERY_VERSION,'styles.css?v='+RECOVERY_VERSION];
const ROOT_ASSET_PATHS=new Set(['app.js','coach-engine.js','coach-ui.js','v5-core.js','v5-runtime.js','v5-config.js','styles.css','manifest.json','icon.svg','icon-192.png','icon-512.png','recovery.js'].map(name=>new URL(name,ROOT).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('brandon-fitness-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){
  const isApp=url.pathname===ROOT.pathname||url.pathname===new URL(APP_HTML).pathname;
  if(!isApp&&url.pathname!==RECOVERY_HTML)return;
  const cacheKey=isApp?APP_HTML:event.request;
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   try{
    const response=await fetch(event.request,{cache:'no-store',signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw Error('Navigation failed');
    await cache.put(cacheKey,response.clone());return response;
   }catch{
    return await cache.match(cacheKey)||(!isApp&&await cache.match(new URL('recovery.html',ROOT).href));
   }
  })());return;
 }
 // A sibling page's app.js must never be served from or added to the root cache.
 if(!ROOT_ASSET_PATHS.has(url.pathname))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(event.request);if(cached)return cached;const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;})());
});

