import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadConfig } from './lib/config.ts'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')
const root = createRoot(rootEl)

// Nothing in the app can talk to AWS until config.json has loaded, so wait for
// it before rendering and show a readable message if it can't be found.
loadConfig()
  .then(() => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
  .catch((err: unknown) => {
    root.render(
      <div className="app-shell">
        <main className="app-main">
          <div className="auth-card">
            <p className="auth-card__eyebrow">Configuration problem</p>
            <h1 className="auth-card__title">Can't start the booth</h1>
            <p>{err instanceof Error ? err.message : 'Unknown error loading configuration.'}</p>
          </div>
        </main>
      </div>,
    )
  })
