import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './app.tsx';
import { isDesktop, blockContextMenu } from '@/utils/desktop';

// The desktop window has no title bar of its own: the app's headers double as
// one. A class on <html> rather than props threaded through the tree, since
// every rule that follows from it is CSS (see index.css).
if (isDesktop) document.documentElement.classList.add('is-desktop');

// No right-click menu in the packaged app, and so no Inspect Element.
blockContextMenu();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
