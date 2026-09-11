import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Production only. In dev the worker would serve cached bundles over Vite's
// HMR, which looks exactly like edits silently not taking effect.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration fails on file:// and on insecure origins. Everything but
      // offline support still works, so this stays silent rather than showing
      // an error the user cannot act on.
    })
  })
}
