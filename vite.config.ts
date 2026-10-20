import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // amazon-cognito-identity-js depends on the `buffer` package, which reads
  // Node's `global` at load time. Browsers don't have it, so the whole app
  // would crash to a blank page. `globalThis` is the browser equivalent.
  define: {
    global: 'globalThis',
  },
})