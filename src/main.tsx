import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

// Register Service Worker for PWA + push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });
  });
}
