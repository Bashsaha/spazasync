import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` throws on import outside a React Server bundler condition
      // (vitest's node env is not one). Stub it to a no-op so server modules
      // that guard themselves with `import 'server-only'` stay unit-testable.
      'server-only': path.resolve(__dirname, './tests/server-only-stub.ts'),
    },
  },
})
