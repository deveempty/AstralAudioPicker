import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Browser-only UI review: no Electron process, audio access or update downloads.
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version) },
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
})
