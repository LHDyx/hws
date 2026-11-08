// Service Worker for 作业王 v1.6.5 - 缓存管理
// HTML 使用 Network-First，静态资源使用 Cache-First

const CACHE_NAME = 'homework-king-v1.6.5';
const CORE_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './ico.png',
    './logs.html',
    './logs.css',
    './logs.js',
    './logs-core.js',
    './settings.html',
    './settings.css',
    './settings.js',
    './title-parse.js',
    './intro/intro.css',
    './intro/intro.js',
    './intro/assets/tingyuge.png'
];
const OPTIONAL_ASSETS = [
    './img/ad01.png',
    './img/ad02.png',
    './img/bgimg.png',
    './img/vscode.jpg'
];

function isCacheableResponse(response) {
    return response && response.status === 200 && !response.url.startsWith('blob:');
}

self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(CORE_ASSETS).then(function () {
                return Promise.all(
                    OPTIONAL_ASSETS.map(function (asset) {
                        return cache.add(asset).catch(function () {
                            return null;
                        });
                    })
                );
            });
        }).then(function () {
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.map(function (name) {
                    if (name !== CACHE_NAME) {
                        return caches.delete(name);
                    }
                })
            );
        }).then(function () {
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', function (event) {
    var requestUrl = new URL(event.request.url);

    if (requestUrl.origin !== self.location.origin) return;
    if (event.request.method !== 'GET') return;

    // 更新公告始终走网络，且不写入缓存，避免读到旧版本
    if (requestUrl.pathname.endsWith('/update.json')) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' }).catch(function () {
                return new Response('', { status: 503, statusText: 'Offline' });
            })
        );
        return;
    }

    var isHtmlRequest = event.request.mode === 'navigate' ||
        requestUrl.pathname === '/' ||
        requestUrl.pathname.endsWith('.html');

    event.respondWith(
        caches.open(CACHE_NAME).then(function (cache) {
            if (isHtmlRequest) {
                return fetch(event.request).then(function (networkResponse) {
                    if (isCacheableResponse(networkResponse)) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(function () {
                    return cache.match(event.request).then(function (cachedResponse) {
                        return cachedResponse || cache.match('./index.html');
                    });
                });
            }

            return cache.match(event.request).then(function (cachedResponse) {
                if (cachedResponse) {
                    fetch(event.request).then(function (networkResponse) {
                        if (isCacheableResponse(networkResponse)) {
                            cache.put(event.request, networkResponse.clone());
                        }
                    }).catch(function () {});
                    return cachedResponse;
                }

                return fetch(event.request).then(function (networkResponse) {
                    if (isCacheableResponse(networkResponse)) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                });
            });
        })
    );
});

self.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then(function (keys) {
            return Promise.all(keys.map(function (key) {
                if (key === CACHE_NAME || key.indexOf('homework-king-') === 0) {
                    return caches.delete(key);
                }
                return null;
            }));
        }).then(function () {
            return self.clients.matchAll().then(function (clients) {
                clients.forEach(function (client) {
                    client.postMessage({ type: 'CACHE_CLEARED' });
                });
            });
        });
    }
});
