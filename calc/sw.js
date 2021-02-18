const CACHE_NAME = 'calc-v1';

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(
            cache => cache.addAll([
                './index.html',
                './common.min.js',
                './common.css',
            ])
        )
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(res => (res || fetch(e.request)))
    );
});
