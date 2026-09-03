import { defineConfig, devices } from '@playwright/test';

// E2E-слой из docs/TESTING.md: mock-режим (VITE_CLERK_PUBLISHABLE_KEY НЕ задаётся —
// приложение само уходит в mock, см. App.tsx). Dev-server поднимается автоматически.
const workersCount = process.env.CI ? 2 : 1; // T-30: тяжёлые тесты на одном dev-сервере
export default defineConfig({
  workers: process.env.CI ? 2 : 1, // T-30: тяжёлые транскрипционные тесты на одном dev-сервере
  retries: 1, // e2e-флейки инфраструктуры (dev-server) — 1 повтор
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    timeout: 120_000,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Мобильные регрессии — только в проекте «mobile».
      // Regex без ведущей ".*\.": файлы лежат в tests/e2e/, перед "mobile" стоит "/".
      testIgnore: /mobile\.spec\.ts|touch-gestures\.spec\.ts/,
    },
    {
      // Pixel 7: 412×915, hasTouch, mobile UA
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /mobile\.spec\.ts|touch-gestures\.spec\.ts/,
    },
  ],
});
