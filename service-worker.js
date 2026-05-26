// ===== SERVICE WORKER — ESCALA 5X2 =====
const CACHE_NAME = 'escala-5x2-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js'
];

// ===== INSTALL: faz cache dos arquivos principais =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// ===== ACTIVATE: limpa caches antigos =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ===== FETCH: serve do cache, com fallback para rede =====
self.addEventListener('fetch', event => {
  // Ignora requisições ao Firebase (sempre online)
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Guarda no cache se for um recurso estático
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback
      if (event.request.destination === 'document') {
        return caches.match('/index.html');
      }
    })
  );
});

// ===== NOTIFICAÇÕES PUSH =====
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Escala 5x2';
  const options = {
    body: data.body || 'Você tem uma atualização na escala.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'escala-notif',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ===== CLIQUE NA NOTIFICAÇÃO =====
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ===== MENSAGENS DO APP (agendar notificações locais) =====
self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'AGENDAR') return;

  const { minhaCor, togAmanha, tog2dias } = event.data;

  // Calcula próxima folga com base na cor (escala 5x2: seg a sex trabalha, sab/dom folga)
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0=dom, 6=sab

  let diasParaFolga = 0;
  if (diaSemana === 5) diasParaFolga = 1;       // sexta → folga amanhã (sábado)
  else if (diaSemana === 4) diasParaFolga = 2;   // quinta → folga em 2 dias
  else if (diaSemana === 6) diasParaFolga = 0;   // sábado → hoje é folga
  else if (diaSemana === 0) diasParaFolga = 0;   // domingo → hoje é folga
  else diasParaFolga = 6 - diaSemana;            // seg/ter/qua

  if (diasParaFolga === 1 && togAmanha) {
    self.registration.showNotification('🎉 Folga amanhã!', {
      body: 'Seu fim de semana começa amanhã! Aproveite!',
      icon: '/icons/icon-192.png',
      tag: 'folga-amanha',
      vibrate: [200, 100, 200]
    });
  } else if (diasParaFolga === 2 && tog2dias) {
    self.registration.showNotification('📅 Fim de semana em 2 dias!', {
      body: 'Faltam só 2 dias para o seu fim de semana!',
      icon: '/icons/icon-192.png',
      tag: 'folga-2dias',
      vibrate: [200, 100, 200]
    });
  }
});
