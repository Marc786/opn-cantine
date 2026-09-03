import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Node by default: most suites are pure logic or talk to MongoDB. Suites
    // that render components opt into jsdom with a `@vitest-environment`
    // docblock, so they do not slow the rest down.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    // Each suite boots its own in-process MongoDB; the first run also has to
    // download the binary.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
