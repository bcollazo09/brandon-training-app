'use strict';
const CACHE='brandon-fitness-v5-preview-2';
const VERSION='5.0.0-preview.2';
const ASSETS=['./','index.html','styles.css?v='+VERSION,'app.js?v='+VERSION,'v5-config.js?v='+VERSION,'v5-core.js?v='+VERSION,'v5-runtime.js?v='+VERSION,'coach-engine.js?v='+VERSION,'coach-ui.js?v='+VERSION,'manifest.json','icon-192.png','icon-512.png','icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('brandon-fitness-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
 if(event.request.mode==='navigate'){
  event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(event.request,{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)throw Error('Navigation failed');await cache.put('index.html',response.clone());return response;}catch{return await cache.match('index.html');}})());return;
 }
 const name=url.pathname.split('/').pop();
 if(!['app.js','coach-engine.js','coach-ui.js','v5-core.js','v5-runtime.js','v5-config.js','styles.css','manifest.json','icon.svg','icon-192.png','icon-512.png'].includes(name))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE),cached=await cache.match(event.request);if(cached)return cached;const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;})());
});
