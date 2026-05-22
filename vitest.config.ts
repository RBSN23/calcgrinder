import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Unit/integration tests are co-located under src/ (e.g.
    // src/app/api/cron/purge/route.test.ts). Playwright E2E specs live
    // under tests/ and use a different runner — Vitest must skip them.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'tests/**', '.next/**', 'playwright-report/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Next.js provides `server-only` at runtime via its webpack
      // resolver. Vitest doesn't, so the import fails. Map it to an
      // empty stub for test runs — the production-side guard remains
      // active through Next's bundler.
      'server-only': resolve(__dirname, './src/test/server-only-stub.ts'),
    },
  },
})
