# Стратегия тестирования Anotee.app

> Три слоя тестов + встроенная диагностика. Цель: любой агент/разработчик может доказать, что пользовательские пути работают, **без доступа к прод-бэкенду** — в mock-режиме.

## 0. Слои

| Слой | Инструмент | Что проверяет | Запуск |
|---|---|---|---|
| Unit | Vitest | Чистые функции: таймкоды, экспорт (XML/CSV/EDL), entitlements, утилиты, целостность i18n-ключей, логика тест-сьюта | `npm run test` |
| E2E | Playwright | Пользовательские пути в mock-режиме: лендинг → вход → дашборд → проект → плеер → комментарий (в т.ч. голосовой ввод с моком SpeechRecognition), мобильный viewport | `npm run test:e2e` |
| In-app Diagnostics | `components/TestRunner.tsx` (`/test`) | Живое окружение: API, auth-guard'ы, CDN/CORS, микрофон, viewport/safe-area, хранилище — с гипотезой причины и готовым текстом задачи при падении | Вручную / из админки |
| CI | GitHub Actions | tsc + unit + build на каждый PR | автоматически |

## 1. Unit-тесты (Vitest)

- Расположение: `tests/unit/*.test.ts` (зеркалит `services/`).
- Правила:
  - Тестируем **чистые функции** без DOM: `services/utils.ts` (formatTimecode, isExpired, getDaysRemaining…), `services/exportService.ts` (валидная структура XML/CSV/EDL, кадры вместо секунд), `services/entitlements.ts` (матрица plan×feature), `services/userUtils.ts`, `services/planLabels.ts`.
  - **i18n-контракт**: `tests/unit/i18n.test.ts` — en.json и ru.json содержат идентичный набор ключей; es/ja/ko/pt не содержат ключей, отсутствующих в en.
  - **Тест-сьют контракт**: `tests/unit/testSuite.test.ts` — каждый тест в `TEST_SUITE` имеет непустые description/passCondition/failCondition (без этого Diagnostics 2.0 не имеет права падать «немо»).
- Команда: `npm run test` (watch: `npm run test:watch`).

## 2. E2E (Playwright, mock-режим)

- Расположение: `tests/e2e/*.spec.ts`. Конфиг: `playwright.config.ts` (dev-server поднимается автоматически: `npm run dev`, порт 5173; `VITE_CLERK_PUBLISHABLE_KEY` не задаётся → приложение само уходит в mock).
- Базовые пользовательские пути:
  - `landing.spec.ts`: лендинг рендерится, нет ошибок консоли, кнопка входа работает (mock-вход автоматический).
  - `dashboard.spec.ts`: mock-проекты видны, создание проекта, мобильный viewport 390×844 — кнопки действий карточки доступны без hover.
  - `player.spec.ts`: открытие проекта → плеер; таймкод рендерится; комментарий создаётся и появляется в списке; маркер IN/OUT ставится.
  - `voice.spec.ts`: мок `webkitSpeechRecognition` → клик по Mic в поле комментария → transcript попадает в input → комментарий содержит текст.
  - `diagnostics.spec.ts`: `/test` открывается, «Run Full Suite» выполняется, health-score отображается.
- Мобильные проверки (`test.use({ viewport: { width: 390, height: 844 } })`):
  - Кнопки действий карточек проекта **видимы без hover** (регресс T-08).
  - Поле комментария и Mic-кнопка плеера в пределах вьюпорта и кликабельны.
- Команда: `npm run test:e2e` (headless), `npm run test:e2e:ui` (интерактивно). Браузер по умолчанию — Chromium; установка: `npx playwright install chromium`.

## 3. System Diagnostics 2.0 (in-app)

Встроенная страница `/test` — единственный слой, который видит **реальное окружение пользователя/админа**. Требования к любому тесту сьюта (`services/testSuite.ts`):

- `description` — что проверяем; `passCondition`/`failCondition` — критерии; при `passed:false` обязателен `diagnosis` (гипотеза причины) и `task` (готовый markdown-текст задачи для docs/TASKS.md).
- Группы: Environment, Backend API, Media/CDN, Voice Input, Storage, Billing, Data Integrity, i18n/UI.
- Health Score + экспорт отчёта (Markdown/JSON) для вставки в задачу.

## 4. CI (GitHub Actions)

`.github/workflows/ci.yml`: на PR и push в `main`:
1. `npm ci`
2. `npx tsc --noEmit`
3. `npm run test`
4. `npm run build`

E2E в CI — отдельная job (Chromium), запускается для PR с меткой `e2e` (экономия минут).

## 5. Что НЕ покрывается (сознательно)

- Реальные платежи (ЮKassa/Prodamus) — только контрактные проверки эндпоинтов.
- Реальный Google Drive/S3 — в e2e используется mock-режим; интеграции проверяются Diagnostics на живом окружении.
- Safari/iOS-специфика (SpeechRecognition, fullscreen fallback) — ручной чеклист перед релизом (см. AGENTS.md §5 mobile-checklist).
