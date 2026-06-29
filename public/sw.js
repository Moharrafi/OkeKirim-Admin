// OkeMitra Service Worker
// Strategy: Network-first for API/dynamic, Cache-first for static assets

const CACHE_VERSION = 'v1'
const STATIC_CACHE = `okemitra-static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `okemitra-dynamic-${CACHE_VERSION}`

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/logoapk.png',
  '/apple-icon.png',
  '/offline.html',
]

// ─── Install ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  )
  self.skipWaiting()
})

// ─── Activate ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// ─── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== location.origin) return

  // API routes → Network-first, no caching
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ error: 'Tidak ada koneksi internet' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    )
    return
  }

  // Next.js static / _next/static → Cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Pages → Network-first, fall back to cache, then offline page
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        // For navigation requests, show offline page
        if (request.mode === 'navigate') {
          return caches.match('/offline.html')
        }
        return new Response('Offline', { status: 503 })
      })
  )
})
