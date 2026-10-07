const C='pdf-editor-v1';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||!/^https?:/.test(e.request.url))return;
  e.respondWith(caches.open(C).then(async c=>{
    const hit=await c.match(e.request);
    const net=fetch(e.request).then(r=>{if(r&&(r.ok||r.type==='opaque'))c.put(e.request,r.clone()).catch(()=>{});return r}).catch(()=>hit);
    return hit||net;
  }));
});
