self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', (e) => {
  // Ne pas intercepter les requêtes vers Supabase
  if (e.request.url.includes('supabase.co')) return;
  e.respondWith(fetch(e.request));
});
