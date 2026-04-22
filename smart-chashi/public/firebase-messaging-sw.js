importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC3VQwrWFktjXx5Y6vaU3_L1X4BWh7d3qA",
  authDomain: "gen-lang-client-0285470958.firebaseapp.com",
  projectId: "gen-lang-client-0285470958",
  storageBucket: "gen-lang-client-0285470958.firebasestorage.app",
  messagingSenderId: "204509878030",
  appId: "1:204509878030:web:ca1d9832e1a7045a26e95f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
