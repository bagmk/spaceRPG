/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDI7BjOMEfGy_SaMJsmpG2YEI2nzMHgA0I',
  authDomain: 'the-big-bang-84499.firebaseapp.com',
  projectId: 'the-big-bang-84499',
  storageBucket: 'the-big-bang-84499.firebasestorage.app',
  messagingSenderId: '277610981534',
  appId: '1:277610981534:web:6c4dd67e8b52cb5992738f',
});

const messaging = firebase.messaging();

// Handle background push messages
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || 'Cosmic Coalescence';
  const body = data.body || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    tag: data.tag || 'default',
  });
});

// Handle scheduled notification from the app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SCHEDULE_NOTIFICATION') {
    const { delayMs, title, body, tag } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body,
        icon: '/icon-192.png',
        tag: tag || 'scheduled',
      });
    }, delayMs);
  }
});
