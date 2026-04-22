// Vitest 4.x uses oxc, which reads tsconfig.json directly (incl.
// experimentalDecorators: true). No `esbuild` block is needed here.
// If this repo ever downgrades to Vitest <4, restore the esbuild block
// that pins experimentalDecorators + useDefineForClassFields:false.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: false,
    clearMocks: true,
  },
});
