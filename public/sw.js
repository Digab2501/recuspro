self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch', (e) => {
  // Ne jamais intercepter les requêtes non-GET (POST vers l'API, etc.)
  if (e.request.method !== 'GET') return;

  // Ne pas intercepter les requêtes vers Supabase ou vers ton API
  if (e.request.url.includes('supabase.co')) return;
  if (e.request.url.includes('/api/')) return;

  e.respondWith(fetch(e.request));
});
