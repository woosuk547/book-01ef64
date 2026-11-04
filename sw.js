// 책자를 한 번 열면 여는 화면과 암호문을 기기에 저장해 인터넷 없이도 열리게 한다.
// 인터넷이 되면 새 판을 먼저 받고, 안 되거나 오래 걸리면 저장해 둔 판을 연다. 복호화 키는 저장하지 않는다.
const CACHE = 'book-v1';
const PAGE = './';
const BOOK = 'book.bin';
const WAIT_MS = 5000;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll([PAGE, BOOK].map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function fresh(event, key) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(key);
  const net = fetch(event.request).then(async (res) => {
    if (res.ok) await cache.put(key, res.clone());
    return res;
  });
  event.waitUntil(net.catch(() => {})); // 저장본을 먼저 내줘도 새 판은 끝까지 받아 둔다
  if (!saved) return net;
  const late = new Promise((resolve) => { setTimeout(() => resolve(null), WAIT_MS); });
  try {
    return (await Promise.race([net, late])) || saved;
  } catch {
    return saved;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') event.respondWith(fresh(event, PAGE));
  else if (url.pathname.endsWith(`/${BOOK}`)) event.respondWith(fresh(event, BOOK));
});
