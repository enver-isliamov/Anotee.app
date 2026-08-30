# Стратегия тестирования Anotee.app

> Три слоя тестов + встроенная диагностика. Цель: любой агент/разработчик может доказать, что пользовательские пути работают, **без доступа к прод-бэкенду** — в mock-режиме.

## 0. Слои

| Слой | Инструмент | Что проверяет | Запуск |
|---|---|---|---|
| Unit | Vitest | Чистые функции: таймкоды, экспорт (XML/CSV/EDL), entitlements, утилиты, целостность i18n-ключей, логика тест-сьюта | `npm run test` (watch: `npm run test:watch`) |
| E2E | Playwright | Пользовательские пути в mock-режиме: дашборд → проект → плеер → комментарий (в т.ч. голосовой ввод с моком SpeechRecognition), мобильный viewport (Pixel 7) | `npm run test:e2e` (интерактивно: `npx playwright test --ui`) |
| In-app Diagnostics | `components/TestRunner.tsx` (`/test`) | Живое окружение: API, auth-guard'ы, CDN/CORS, микрофон, viewport/safe-area, хранилище — с гипотезой причины и готовым текстом задачи при падении | Вручную / из админки |
| CI | GitHub Actions | tsc + unit + build на каждый push/PR; e2e — отдельная job (Chromium) | автоматически |

**Важно про mock-режим:** без `VITE_CLERK_PUBLISHABLE_KEY` (или с placeholder-ключом) `vite.config.ts` алиасит `@clerk/clerk-react` на заглушку `services/clerkShim.ts` — иначе Clerk-хуки в дереве (DriveProvider и др.) роняют приложение в ErrorBoundary. С реальным ключом алиас не применяется и работает настоящий Clerk.

## 1. Unit-тесты (Vitest)

- Расположение: `tests/unit/*.test.ts` (зеркалит `services/`). Конфиг: `vitest.config.ts` (environment `node`).
- Правила:
  - Тестируем **чистые функции** без DOM: `services/utils.ts` (formatTimecode — кадры, `frames = Math.floor(seconds * fps)`, isExpired, getDaysRemaining…), `services/exportService.ts` (валидная структура XML/CSV/EDL, кадры вместо секунд), `services/entitlements.ts` (матрица plan×feature), `services/userUtils.ts`, `services/planLabels.ts`.
  - **i18n-контракт**: `tests/unit/i18n.test.ts` — en.json и ru.json содержат идентичный набор ключей; es/ja/ko/pt не содержат ключей, отсутствующих в en.
  - **Тест-сьют контракт**: `tests/unit/testSuite.test.ts` — каждый тест в `TEST_SUITE` имеет непустые description/passCondition/failCondition (без этого Diagnostics 2.0 не имеет права падать «немо»); fetch при этом заглушен — unit-слой не ходит в сеть.
- Команда: `npm run test` (watch: `npm run test:watch`).

## 2. E2E (Playwright, mock-режим)

- Расположение: `tests/e2e/*.spec.ts`. Конфиг: `playwright.config.ts` (dev-server поднимается автоматически: `npm run dev`, порт 5173, `reuseExistingServer: true`; `VITE_CLERK_PUBLISHABLE_KEY` не задаётся → приложение само уходит в mock). Общие хелперы — `tests/e2e/support.ts`.
- Проекты: `chromium` (десктоп) и `mobile` — **Pixel 7, 412×915** (`devices['Pixel 7']`); мобильный файл — `mobile.spec.ts`, запускается только в проекте «mobile».
- Базовые пользовательские пути:
  - `landing.spec.ts`: в mock-режиме вход автоматический, поэтому `/` — это дашборд: приложение рендерится, бейдж PREVIEW MODE виден, нет критических ошибок консоли (ошибки загрузки внешних ресурсов не считаются критическими).
  - `dashboard.spec.ts`: mock-проекты (`MOCK_PROJECTS` из `constants.ts`) видны, проект открывается.
  - `player.spec.ts`: открытие проекта → плеер; таймкод рендерится; комментарий создаётся и появляется в списке.
  - `voice.spec.ts`: мок `webkitSpeechRecognition` (по `start()` через ~200мс отдаёт `onresult` c transcript и `onend`) → клик по Mic в поле комментария → transcript попадает в input → комментарий с этим текстом в списке.
  - `diagnostics.spec.ts`: `/test` открывается, «Run Full Suite» выполняется, статус и сводка видны.
  - `mobile.spec.ts` (412×915): то, что работает сейчас — бар комментария и mic-кнопка видимы/кликабельны; известные регрессии T-08 (hover-only кнопки карточек, скрытый view-switcher) зафиксированы как `test.fixme('T-08: …')` — сьют зелёный, задача не теряется; после фикса перевести в обычные тесты.
- Команда: `npm run test:e2e` (headless). Браузер по умолчанию — Chromium; установка: `npx playwright install chromium`.

## 3. System Diagnostics 2.0 (in-app)

Встроенная страница `/test` — единственный слой, который видит **реальное окружение пользователя/админа**. Требования к любому тесту сьюта (`services/testSuite.ts`):

- `description` — что проверяем; `passCondition`/`failCondition` — критерии; при `passed:false` обязателен `diagnosis` (гипотеза причины) и `task` (готовый markdown-текст задачи для docs/TASKS.md).
- Группы: Environment, Backend API, Media/CDN, Voice Input, Storage, Billing, Data Integrity, i18n/UI.
- Health Score + экспорт отчёта (Markdown/JSON) для вставки в задачу.
- Контракт метаданных проверяется unit-тестом `tests/unit/testSuite.test.ts`.

## 4. CI (GitHub Actions)

`.github/workflows/ci.yml` — на push и PR в `main`/`chore/**`:

1. Job **build-test** (setup-node 20): `npm ci` → `npx tsc --noEmit` → `npm run test` → `npm run build`.
2. Job **e2e** (после build-test): `npx playwright install --with-deps chromium` → `npm run test:e2e`; отчёт Playwright выгружается артефактом при падении.

## 5. Что НЕ покрывается (сознательно)

- Реальные платежи (ЮKassa/Prodamus) — только контрактные проверки эндпоинтов.
- Реальный Google Drive/S3 — в e2e используется mock-режим; интеграции проверяются Diagnostics на живом окружении.
- Safari/iOS-специфика (SpeechRecognition, fullscreen fallback) — ручной чеклист перед релизом (см. AGENTS.md §5 mobile-checklist).
