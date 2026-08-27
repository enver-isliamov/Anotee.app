# AGENTS.md — Anotee.app

> **Точка входа для ИИ-агентов и разработчиков.** Этот файл — обязательный контекст для любой работы в репозитории. Правила раздела «Железные правила» превалируют над любыми соображениями UX, краткости или стиля кода.

## 1. Что это

**Anotee** — веб-платформа ревью видео для фильммейкеров (аналог Frame.io): загрузка версий видео в Google Drive / S3, таймкод-комментарии, голосовые комментарии (SpeechRecognition), экспорт маркеров в NLE (DaVinci Resolve XML, Premiere CSV, EDL), командный доступ и публичные guest-ссылки, биллинг (ЮKassa / Prodamus), админ-панель с feature flags и управлением пользователями, встроенная страница диагностики `/test`.

- **Live:** https://anotee.com
- **Версия:** динамическая, управляется из админки (`hooks/useAppVersion.ts`); базовая в `package.json`.

## 2. Быстрый старт

```bash
npm install          # установка зависимостей
npm run dev          # dev-сервер Vite (http://localhost:5173)
npm run build        # прод-сборка в dist/ (vite build, БЕЗ tsc!)
npx tsc --noEmit     # проверка типов (запускать отдельно и обязательно!)
npm run i18n:extract # извлечение ключей i18next
npm run test         # unit-тесты (vitest)
npm run test:e2e     # e2e-тесты (Playwright, mock-режим)
```

**Mock-режим.** Если `VITE_CLERK_PUBLISHABLE_KEY` отсутствует или выглядит как placeholder (`App.tsx:762-773`), приложение стартует в **mock-режиме**: пользователь уже «вошёл» (`mock-user`), бэкенд не нужен, проекты из `constants.ts` (MOCK_PROJECTS). Это режим для локальной разработки и e2e-тестов. Реальный бэкенд требует `.env` (см. `.env.example`) и Vercel-окружения.

## 3. Карта репозитория

| Путь | Назначение |
|---|---|
| `index.tsx` | Точка входа React |
| `App.tsx` | Корневой компонент: провайдеры (Clerk/i18n/theme/Drive), state-based роутинг (`view.type`), парсинг URL (`/test` → TestRunner) |
| `components/Player.tsx` | **Плеер**: видео, таймлайн, комментарии, маркеры IN/OUT, голосовой ввод (3 кнопки Mic), VoiceModal, FloatingControls, экспорт NLE, AI-транскрибация видео (Whisper-воркер) |
| `components/Dashboard.tsx` | Проекты «Мои» / «Доступные мне», создание, шэринг |
| `components/ProjectView.tsx` | Ассеты проекта, загрузка файлов (useUploadManager), версии |
| `components/Profile.tsx` | Профиль, BYOS (S3-конфиг), подписка |
| `components/AdminPanel.tsx` + `components/admin/*` | Админка: пользователи, feature flags, платежи, контент, стратегия |
| `components/TestRunner.tsx` | Страница **System Diagnostics** (`/test`), рендерит `services/testSuite.ts` |
| `components/LegalPages.tsx` | Юридические документы (см. Железное правило №9) |
| `components/Roadmap/*` | Публичный roadmap с голосованием |
| `services/` | apiClient, googleDrive, audioUtils, transcriptionWorker (Whisper), exportService (XML/CSV/EDL), i18n, testSuite, utils |
| `hooks/` | useUploadManager, useAppConfig, useAppVersion, useRoadmap, useSubscription |
| `api/*.js` | Vercel Serverless Functions (Node.js): `data`, `admin`, `payment`, `storage`, `upload`, `cron`, `health`, `proxyAudio` + хелперы `_auth`, `_permissions`, `_s3`, `_crypto` |
| `types.ts` | Все доменные типы (Project, Asset, Version, Comment, конфиги) |
| `constants.ts` | Дефолтные конфиги, MOCK_PROJECTS |
| `docs/` | Документация (см. §10) |

## 4. 🚨 Железные правила (НЕ НАРУШАТЬ)

Источник: `.cursorrules` (актуален и обязателен).

1. **≤12 файлов в `/api`.** Лимит Vercel Hobby. Новую серверную логику добавляй в существующий файл-контроллер через `?action=...`, а не новым файлом.
2. **НИКОГДА не добавляй `crossOrigin="anonymous"` к `<video>`.** Стриминг с Google Drive идёт «opaque»-ответами; strict CORS ломает видео (чёрный экран).
3. **Google Drive — только легаси-URL** `https://drive.google.com/uc?export=download&confirm=t&id={FILE_ID}` для `src` видео. API v3 c Authorization ломает Range-запросы (перемотку).
4. **Таймкоды — в кадрах.** FPS определять через `requestVideoFrameCallback`, не хардкодить. `frames = Math.floor(seconds * fps)`; никакой арифметики времени в долях секунд.
5. **Auth на бэкенде — только через `verifyUser(req)` из `api/_auth.js`.** Не удалять оптимизацию JWT Custom Claims (лимиты Clerk API).
6. **Не создавать `src/`.** Корень репозитория — исходники: `/components`, `/services`, `/hooks`, `/api`.
7. **Комментарии `// CRITICAL`, `// FIXED`, `// FIXED:` — не удалять** без глубокого анализа: это фикс-ы багов браузеров/API.
8. **Юридические тексты (`LegalPages.tsx`) не сокращать**: полнота, формальность, «AS IS», no-refund — приоритет над UX.
9. **Инкрементальный рефакторинг.** Один компонент за раз; меняя сигнатуру — обнови всех вызывающих; не переписывай всё сразу.
10. **Новые фичи** — сначала этап в `docs/ToDo.MD` (план + тестирование), потом код.

## 5. Конвенции кода и UI

- **TypeScript strict.** Типы домена — только в `types.ts`. Избегать `any` (легаси допускается, не размножать). `npx tsc --noEmit` должен проходить до коммита.
- **Функциональные компоненты + хуки.** Стили — утилитарные классы Tailwind; тёмная тема по умолчанию (пары `text-zinc-... dark:text-...`). Иконки — `lucide-react`.
- **i18n.** Никаких захардкоженных строк в UI — только `t('ключ')`. Источник ключей — `services/locales/en.json`, полный русский — `ru.json`. es/ja/ko/pt сейчас частичны (fallback en) — при добавлении ключей прогоняй `npm run i18n:extract`.
- **Mobile-first чеклист** (обязателен для любого UI-изменения):
  - [ ] Нет hover-only функциональности: на ширинах `<md` все действия доступны без наведения (`opacity-0 group-hover:*` — только как улучшение поверх видимой кнопки).
  - [ ] Тач-таргеты ≥ 40×40px.
  - [ ] Fixed-панели учитывают `env(safe-area-inset-bottom)`.
  - [ ] Высоты экранов через `h-[100dvh]`, не `h-screen` для корневых каркасов.
  - [ ] `window.innerWidth/innerHeight` в рендере запрещены — только через state + `resize`-листенер.
  - [ ] Ничего не прячется через `hidden md:block`, если это единственная точка доступа к функции.
- **Коммиты:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`), как в истории репозитория.

## 6. Безопасность — контекст

Актуальный аудит: [`docs/audit/CODE_AUDIT_2026-08-27.md`](docs/audit/CODE_AUDIT_2026-08-27.md). Найдены P0 (webhook платежей без проверки подписи, org-IDOR, фолбэк мастер-ключа шифрования) — см. бэклог `docs/TASKS.md`. **Правила для нового кода:**

- Любой новый serverless `action` начинается с `verifyUser(req)` и, если трогает проект, — `checkProjectAccess`.
- Секреты только в env на сервере; в ответах API секреты не возвращать.
- S3-ключи/пути всегда ограничивать проектом (никаких свободных `key` от клиента).
- Пользовательский ввод в SQL — только через tagged-templates `sql`...`` (защита от инъекций уже встроена; не конкатенировать строки).

## 7. Мультиагентский протокол

1. **Задачи** берутся из [`docs/TASKS.md`](docs/TASKS.md) (или создаются по шаблону оттуда же). Не начинай работу без записи в TASKS.
2. **Ветки:** `feat/<id>-краткое-имя` / `fix/<id>-...` от `main`. Прямые пуши в `main` запрещены (кроме docs-мелочей).
3. **Координация файлов:** `App.tsx`, `Player.tsx`, `ProjectView.tsx` — монолиты с высокой конфликтностью. Один агент = один такой файл за раз; изменение обсуждать в задаче до старта.
4. **Definition of Done:** код + `npx tsc --noEmit` зелёный + `npm run build` зелёный + `npm run test` зелёный + для UI-изменений: мобильный чеклист §5 + ручная проверка в mock-режиме (`npm run dev`).
5. **Диагностика проблем у пользователя:** прогнать `https://anotee.com/test` (System Diagnostics) → упавший тест содержит гипотезу причины и готовый текст задачи → занести задачу в `docs/TASKS.md`.

## 8. Опасные зоны (не трогать без явной задачи)

- `api/payment.js` — деньги: изменения только с тест-планом и владельцем проекта.
- `api/_auth.js` — смена логики токенов ломает ВСЕ эндпоинты.
- Расчёт FPS/таймкода в `Player.tsx` — рассинхрон маркеров у всех пользователей.
- `services/googleDrive.ts` (формат URL, resumable upload) — хрупкая интеграция.

## 9. Известный техдолг (кратко, полный список в TASKS)

- Монолиты: `Player.tsx` (~1100 строк), `App.tsx`, `Profile.tsx` — пилить по методологии §4.9.
- Бандл: главный чанк 817KB + воркер 877KB + ort-wasm 21.6MB в dist (TASKS T-11).
- i18n: es/ja/ko/pt ≈ 39/277 ключей (TASKS T-10).

## 10. Карта документации

| Документ | Содержимое |
|---|---|
| `AGENTS.md` | Этот файл — начни здесь |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Архитектура: модули, API-матрица, данные, хранилища, биллинг |
| [`docs/TESTING.md`](docs/TESTING.md) | Стратегия тестирования: unit/e2e/диагностика, CI |
| [`docs/TASKS.md`](docs/TASKS.md) | Бэклог задач + шаблон постановки задач |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | Жизненный цикл данных и пользовательские пути (детально) |
| [`docs/SETTINGS.md`](docs/SETTINGS.md) | «Абсолютная истина» по Drive и Плееру — читать перед изменениями Player |
| [`docs/ToDo.MD`](docs/ToDo.MD) | История архитектурных этапов (XXVII–XXXI) |
| [`docs/audit/CODE_AUDIT_2026-08-27.md`](docs/audit/CODE_AUDIT_2026-08-27.md) | Полный аудит кода с файлами/строками |
| [`docs/archive/`](docs/archive/) | Черновики и заметки предшественников |
| `.cursorrules` | Правила для Cursor (дублируют §4; при изменении правил обновлять оба файла) |
