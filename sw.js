/* ==========================================================================
   DocEasy Service Worker (sw.js)
   Version: v4 (Updated to clear old cache and fix Favicon/Header)
   ========================================================================== */

const CACHE_NAME = 'doceasy-v4';

// ये फाइलें सबसे पहले कैश होंगी (Core Assets)
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/doceasy-global.css',
  '/assets/js/core/doceasy-core.js',
  '/assets/images/favicon.png',
  '/assets/images/favicon.ico',
  '/assets/images/icon-512.png'
];

// 1. INSTALL EVENT: जब पहली बार साइट खुलेगी, तो ये फाइलें सेव करेगा
self.addEventListener('install', (event) => {
  // नया सर्विस वर्कर तुरंत एक्टिवेट हो जाए
  self.skipWaiting(); 
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE EVENT: जब नया वर्जन (v4) आए, तो पुराने कैश (v1, v2, v3) डिलीट कर दे
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Purani Cache Delete Ho Rahi Hai:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // कंट्रोल तुरंत अपने हाथ में ले ले
  self.clients.claim(); 
});

// 3. FETCH EVENT: इंटरनेट से फाइलें लाने का तरीका
self.addEventListener('fetch', (event) => {
  // सिर्फ GET रिक्वेस्ट को हैंडल करें
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // बाहरी सर्विस (जैसे Google AdSense या Analytics) को कैश मत करो
  if (url.origin !== self.location.origin) {
    return;
  }

  // अगर यूजर किसी HTML पेज पर जा रहा है (Network First)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // इंटरनेट से नया मिला, तो कैश में अपडेट करो और दिखाओ
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // इंटरनेट नहीं है, तो कैश से दिखाओ
          return caches.match(event.request);
        })
    );
    return;
  }

  // बाकी चीज़ों के लिए (CSS, JS, Images) - Cache First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; // कैश में मिला तो सीधा दिखाओ
      }
      return fetch(event.request).then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone); // नया मिला तो कैश में सेव करो
        });
        return response;
      });
    })
  );
});
