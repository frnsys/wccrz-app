this.addEventListener('install', function(event) {
  console.log('Installing Service Worker');
  event.waitUntil(this.skipWaiting());
});

this.addEventListener('activate', function(event) {
  console.log('activate');
  event.waitUntil(this.clients.claim());
});

this.addEventListener('fetch', function(event) {
  console.log('fetch', event);
  var url = event.request.url;

  if (url.startsWith('https://') && (url.includes('tiles.mapbox.com') || url.includes('api.mapbox.com'))) {
    console.log('tile');
    event.respondWith(
      caches.match(event.request).then(function(resp) {
        return resp || fetch(event.request).then(function(response) {
          var cacheResponse = response.clone();
          caches.open('mapbox').then(function(cache) {
            cache.put(event.request, cacheResponse);
          });
          return response;
        });
      })
    );
  }
});
