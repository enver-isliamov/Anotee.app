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
      sourcemap: true, // T-70: расшифровка юзер-стеков крашей
      outDir: 'dist',
      // T-151: разделяем вендоров — основной чанк перестаёт быть «монолитом» >500 kB,
      // а react/icons кэшируются браузером между релизами приложения.
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('react-dom') || id.includes('scheduler') || /node_modules[\/\\]react[\/\\]/.test(id)) return 'vendor-react';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('@clerk')) return 'vendor-clerk';
            if (id.includes('@aws-sdk')) return 'vendor-aws';
            if (id.includes('@huggingface')) return 'vendor-hf';
            if (id.includes('@google/genai')) return 'vendor-genai';
            if (id.includes('i18next')) return 'vendor-i18n';
            if (id.includes('@vercel')) return 'vendor-vercel';
            return 'vendor';
          },
        },
      },
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
