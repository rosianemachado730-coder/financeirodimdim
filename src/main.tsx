import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

console.log('[MAIN] main.tsx loaded');

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('[MAIN] Root element not found');
  throw new Error('Root element not found');
}

console.log('[MAIN] Root element found, mounting app');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

console.log('[MAIN] App mounted');
