const CACHE = 'studysync-v1'

// Only cache static files that actually exist
const FILES = [
    '/css/main.css',
    '/css/login.css',
    '/css/dashboard.css',
    '/css/tasks.css',
    '/css/planner.css',
    '/css/pomodoro.css',
    '/css/teacher.css',
    '/js/login.js',
    '/js/dashboard.js',
    '/js/tasks.js',
    '/js/planner.js',
    '/js/pomodoro.js',
    '/js/teacher.js',
]

// Install — cache static files
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(FILES))
    )
    self.skipWaiting()
})

// Activate
self.addEventListener('activate', e => {
    e.waitUntil(clients.claim())
})

// Fetch — serve from cache if offline
self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(cached => {
            return cached || fetch(e.request)
        })
    )
})