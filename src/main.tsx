import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { startUpdateWatch } from './updateCheck';

function syncAppViewportHeight(): void {
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${Math.round(viewportHeight)}px`);
}

syncAppViewportHeight();
window.addEventListener('resize', syncAppViewportHeight);
window.addEventListener('orientationchange', syncAppViewportHeight);
window.addEventListener('pageshow', syncAppViewportHeight);
window.visualViewport?.addEventListener('resize', syncAppViewportHeight);
window.visualViewport?.addEventListener('scroll', syncAppViewportHeight);

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

// Auto-pull the latest build (GitHub Pages can't set no-cache headers). See updateCheck.ts.
startUpdateWatch();

// Register Service Worker for PWA + push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((err) => {
      console.warn('[SW] Registration failed:', err);
    });
  });
}
