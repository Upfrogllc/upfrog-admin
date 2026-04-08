import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import ClientPortal from './ClientPortal.jsx'

// Simple hash-based router
// /         → Admin panel (Upfrog team)
// #portal   → Client portal login
// #portal-magic:TOKEN → Magic link handler (auto-login)

function Root() {
  const hash = window.location.hash;
  const isPortal = hash.startsWith('#portal');
  return isPortal ? <ClientPortal /> : <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
