import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './pwa'
import './index.css'
import App from './App.jsx'
import PwaInstallPrompt from './PwaInstallPrompt.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <PwaInstallPrompt />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => console.warn('SW registration failed', err));
  });
}
