
// Service Worker للتشغيل في الخلفية
const CACHE_NAME = 'audio-library-v1';
const OFFLINE_URL = '/offline.html';

// تثبيت Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll([
                '/',
                '/index.html',
                '/style.css',
                '/app.js',
                'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap',
                'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
            ]);
        })
    );
    self.skipWaiting();
});

// تنشيط Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(clients.claim());
});

// اعتراض الطلبات للتعامل مع وضع عدم الاتصال
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).catch(() => {
                return caches.match(OFFLINE_URL);
            });
        })
    );
});

// استقبال رسائل من التطبيق الرئيسي
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'PLAY_AUDIO') {
        // إعلام التطبيق بأن الصوت يعمل في الخلفية
        event.source.postMessage({
            type: 'AUDIO_PLAYING',
            data: event.data.data
        });
    }
});

// دعم Background Fetch (للتشغيل المستمر)
self.addEventListener('fetch', (event) => {
    // السماح بمرور طلبات YouTube
    if (event.request.url.includes('youtube.com') || 
        event.request.url.includes('ytimg.com')) {
        return;
    }
});
