/**
 * Лёгкая заглушка @clerk/clerk-react для mock-режима (нет VITE_CLERK_PUBLISHABLE_KEY).
 *
 * Подключается через resolve.alias в vite.config.ts ТОЛЬКО когда ключ отсутствует
 * (зеркалит логику isMockMode в App.tsx) — в реальном режиме импорты резолвятся
 * в настоящий @clerk/clerk-react, и этот файл нигде не используется.
 *
 * Зачем: в дереве mock-приложения Clerk-хуки вызывают DriveProvider, useSubscription,
 * useAppConfig, Dashboard, Player, Profile — без провайдера Clerk v5 бросает
 * «useAuth can only be used within the <ClerkProvider />» и всё приложение падает в
 * ErrorBoundary. Заглушка даёт совместимую поверхность API без сети и Clerk JS.
 */
import type { ReactNode } from 'react';

const mockUser = {
  // Совпадает с INTERNAL_MOCK_USERS[0] из constants.ts — владельцем MOCK_PROJECTS.
  id: 'u1',
  fullName: 'Andrey (Creator)',
  firstName: 'Andrey',
  // Локальный статичный аватар (замена внешнего сервиса аватаров, недоступного из РФ — T-17)
  imageUrl: '/img/avatar-mock.svg',
  primaryEmailAddress: { emailAddress: 'mock@example.com' },
  publicMetadata: {},
  unsafeMetadata: {},
};

type WithChildren = { children?: ReactNode };

export const ClerkProvider = ({ children }: WithChildren) => children ?? null;
export const SignedIn = ({ children }: WithChildren) => children ?? null;
export const SignedOut = () => null;
export const SignInButton = ({ children }: WithChildren) => children ?? null;
export const UserButton = () => null;
export const OrganizationSwitcher = () => null;
export const OrganizationProfile = () => null;

export const useUser = () => ({
  isLoaded: true,
  isSignedIn: true,
  user: mockUser,
});

export const useAuth = () => ({
  isLoaded: true,
  isSignedIn: true,
  getToken: async () => 'mock-token',
  signOut: async () => {},
});

export const useOrganization = () => ({
  isLoaded: true,
  organization: undefined,
  memberships: undefined,
});

export const useClerk = () => ({
  signOut: async () => {},
  user: mockUser,
});
