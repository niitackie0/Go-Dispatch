import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { RouterProvider } from './router.tsx';
import './index.css';

/**
 * Take the opening screen down.
 *
 * The markup for it lives in index.html, because it has to be on screen
 * before this bundle is downloaded; the price of that is that removing it is
 * our job. Two frames, not one: the first callback runs after React has
 * committed, the second after the browser has actually painted what it
 * committed, so the fade never uncovers a page that is still blank.
 */
function dismissSplash() {
  const splash = document.getElementById('gd-splash');
  if (!splash) return;

  requestAnimationFrame(() => requestAnimationFrame(() => {
    splash.classList.add('gd-done');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
    // A transition that never fires — reduced motion, a background tab — would
    // otherwise leave it in the tree, invisible and on top of everything.
    window.setTimeout(() => splash.remove(), 600);
  }));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider>
      <App />
    </RouterProvider>
  </StrictMode>,
);

dismissSplash();
