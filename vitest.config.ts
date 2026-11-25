import { defineConfig } from 'vitest/config';

// Unit-слой из docs/TESTING.md: чистые функции без DOM.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
});
