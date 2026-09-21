import { defineConfig, devices } from '@playwright/test';

// T-158: отдельный конфиг для офлайн-теста: поднимает прод-сборку (vite preview).
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /offline\.spec\.ts/,
  timeout: 120_000,
  retries: 0,
  reporter: [['line']],
  use: {
    baseURL: 'http://localhost:4174',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort',
    port: 4174,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
