'use strict';
const PREFIX='bf-v5-isolated-preview-',CACHE=PREFIX+'1',VERSION='5.0.0-preview.1';
const ASSETS=['./','index.html','preview-safety.js','styles.css?v='+VERSION,'app.js?v='+VERSION,'v5-config.js?v='+VERSION,'v5-core.js?v='+VERSION,'v5-runtime.js?v='+VERSION,'coach-engine.js?v='+VERSION,'coach-ui.js?v='+VERSION,'manifest.json','../icon-192.png','../icon-512.png','icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
 const scope=new URL('./',self.location.href).pathname;
 if(event.request.mode==='navigate'){
  if(!url.pathname.startsWith(scope))return;
  event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(event.request,{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Navigation failed');await cache.put('index.html',response.clone());return response;}catch{return await cache.match('index.html');}})());return;
 }
 const known=ASSETS.some(asset=>new URL(asset,self.location.href).href===url.href);
 if(!known)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(event.request);if(cached)return cached;const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;})());
});
