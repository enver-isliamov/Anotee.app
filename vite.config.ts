/// <reference types="node" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  // Зеркалит логику isMockMode в App.tsx: без реального publishable-ключа Clerk
  // приложение работает в mock-режиме (локальная разработка и e2e).
  const shellEnv = process.env.VITE_CLERK_PUBLISHABLE_KEY;
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const clerkKey = shellEnv || fileEnv.VITE_CLERK_PUBLISHABLE_KEY || '';
  const hasRealClerkKey =
    Boolean(clerkKey) &&
    !clerkKey.includes('placeholder') &&
    !clerkKey.includes('YOUR_') &&
    clerkKey.length >= 20;

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
    },
    resolve: hasRealClerkKey
      ? undefined
      : {
          // Mock-режим: подменяем Clerk лёгкой заглушкой (services/clerkShim.ts).
          // Без неё Clerk-хуки в дереве (DriveProvider, useSubscription, Dashboard, …)
          // бросают «useAuth can only be used within the <ClerkProvider />» и
          // mock-приложение падает в ErrorBoundary при старте.
          alias: {
            '@clerk/clerk-react': path.resolve(__dirname, 'services/clerkShim.ts'),
          },
        },
  };
});
