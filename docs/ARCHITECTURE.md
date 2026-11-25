# Архитектура Anotee.app

> Сопровождающий документ. При архитектурных изменениях обновлять этот файл в том же PR.

## 1. Общая схема

```
Браузер (SPA, React 19 + Vite)
  │  Clerk (auth, JWT custom claims)
  │  i18next (ru/en/es/ja/ko/pt)
  │  Google Drive API (resumable upload, CORS-стриминг)
  │  S3 (presigned PUT/GET, BYOS: Yandex/Selectel/R2)
  ▼
Vercel Serverless (api/*.js, ≤12 файлов, роутинг через ?action=)
  ├─ Vercel Postgres / Neon (projects JSON + system_settings)
  ├─ Clerk Backend API (users, orgs, metadata, OAuth-токены)
  ├─ ЮKassa / Prodamus (платежи + webhook)
  └─ Vercel Blob (легаси: аватарки)
```

## 2. Фронтенд

### 2.1 Вход и роутинг

- `index.tsx` → `App.tsx`. Ключ в Clerk невалиден → **mock-режим** (залогиненный mock-user, данные из `constants.ts`) — см. `App.tsx:762-773`.
- Роутера нет. Два механизма:
  1. **URL path** парсится при старте (`App.tsx:305`, например `/test` → `TEST_RUNNER`);
  2. **State-based `view.type`** (`handleNavigate`, `App.tsx:476`): LANDING, DASHBOARD, PROJECT, PLAYER, PROFILE, ADMIN, LIVE_DEMO, LEGAL, TEST_RUNNER…
- Провайдеры (снаружи внутрь): `ErrorBoundary → (ClerkProvider) → LanguageProvider → ThemeProvider → DriveProvider → AuthWrapper/AppLayout`.

### 2.2 Ключевые модули

| Модуль | Ответственность | Заметки |
|---|---|---|
| `Player.tsx` | Воспроизведение, таймлайн в кадрах, комментарии, IN/OUT маркеры, голосовой ввод, VoiceModal, FloatingControls (draggable, clamp, z-9999), экспорт, Whisper-транскрипция | Монолит ~1100 строк; `FloatingControls` объявлен в том же файле |
| `Dashboard.tsx` | Списки «Мои»/«Shared», CRUD проектов, share-модалка (Public Access vs Team Invite) | Кнопки действий карточек — hover-only (см. TASKS T-08) |
| `ProjectView.tsx` | Ассеты, версии, загрузка, прогресс, dead-version handling | Загрузка через `hooks/useUploadManager.ts` |
| `services/apiClient.ts` | Единый fetch к `/api/*` с Bearer-токеном Clerk | |
| `services/googleDrive.ts` | Resumable upload, URL-билдеры (легаси `uc?export=download&confirm=t`), permissions | Железные правила №2-3 |
| `services/audioUtils.ts` | Извлечение аудио (16kHz Float32) для Whisper; лимиты 300MB браузер / 90MB через proxy; закрытие AudioContext в finally | |
| `services/transcriptionWorker.ts` | Web Worker: `@huggingface/transformers` Whisper (Xenova/whisper-tiny), прогресс-колбеки | Используется ТОЛЬКО для транскрибации видео, не для голосовых комментариев |
| `services/exportService.ts` | Генераторы Resolve XML / Premiere CSV / EDL (чистые функции — покрыты unit-тестами) | |
| `hooks/useUploadManager.ts` | Очередь загрузок: превью (canvas 2s), версионирование имён v1/v2, выбор хранилища (S3 presign vs Drive), blob-предпросмотр до завершения, beforeunload-защита | |
| `hooks/useSubscription.ts` / `entitlements.ts` | План и feature-флаги (`isFeatureEnabled(config, key, plan)`) | |

### 2.3 Синхронизация (Smart Polling)

- `Player` активирует polling при монтировании: **15s** в активном режиме (взаимодействие/плейбек), **5m** в idle (60s бездействия), мгновенный force-sync при отправке комментария.
- Запись проекта — **весь JSON целиком** (`POST /api/data?action=sync`). Конкурентность решается CAS по `_version` на сервере, но клиент не обрабатывает 409-конфликты полностью — известный риск потери одновременных правок (аудит §B, TASKS T-05).

## 3. Бэкенд (api/*.js)

Общий каркас: хелперы `_auth.js` (verifyUser — JWT custom claims с фолбэком на Clerk API), `_permissions.js` (checkProjectAccess: owner/team/restricted/public), `_s3.js`, `_crypto.js` (AES для S3-секретов).

| Файл | Actions | Auth | Назначение |
|---|---|---|---|
| `data.js` | GET (project/list/org), POST sync, PATCH, DELETE, comment, drive_token, check_updates, delete_assets | verifyUser | CRUD проектов (JSON-документы) |
| `admin.js` | 17 actions (users, flags, payment_config, domain, AI…) | verifyUser + role admin/superadmin (publicMetadata) | Админка |
| `payment.js` | init, webhook, cancel_sub | init/cancel — verifyUser; **webhook — БЕЗ подписи (P0, TASKS T-01)** | ЮKassa + Prodamus |
| `storage.js` | config, test, configure_cors, presign, delete, delete_folder | verifyUser | BYOS S3 |
| `upload.js` | Vercel Blob handleUpload | verifyUser + checkProjectAccess | Легаси (аватарки) |
| `cron.js` | Ежедневное автопродление подписок | Bearer CRON_SECRET | Vercel Cron 10:00 |
| `health.js` | `{status:'ok'}` | нет | Диагностика |
| `proxyAudio.js` | Прокси Drive-аудио (обход CORS) | нет | SSRF-защита: извлекает только file ID |

### 3.1 Данные

- Таблица `projects`: `id, owner_id, org_id, data (JSONB: Project целиком), _version, updated_at`.
- `Project` (`types.ts`): `assets[] → versions[]` (storageType: 'drive'|'s3', s3Key/googleDriveId), `comments[]` (timestamp, duration, status, authorName), `team[]` (с `restrictedAssetId` для sandbox-гостей), `publicAccess`.
- `system_settings`: feature_flags, payment_config, app version — читается фронтом через `hooks/useAppConfig.ts`.

### 3.2 RBAC / доступ

- Owner → полный; team member → редактирование; restricted guest → один ассет; public guest → read+comment (team скрывается `sanitizeProjectForUser`, `api/data.js:16-57`).
- Admin: `publicMetadata.role ∈ {admin, superadmin}` — проверка на бэкенде для каждого admin-action.
- Известные пробелы: org-list без проверки членства (T-02), viewer может писать (T-06), storage-ключи не ограничены проектом (T-04).

## 4. Биллинг

1. `init`: фронт → `payment?action=init` → создание платежа ЮKassa (save_payment_method для monthly) или Prodamus → редирект.
2. `webhook`: провайдер → `payment` (body-detect) → `upgradeUser` пишет в Clerk `publicMetadata: {plan:'pro', expiresAt, paymentMethodId}`. **Подпись не проверяется — критическая дыра (T-01).**
3. `cron.js` (ежедневно): истекающие подписки → безакцептное списание ЮKassa → продление/даунгрейд.
4. Конфиг тарифов: дефолты в `types.ts` (DEFAULT_PAYMENT_CONFIG), переопределяется из админки (`get_payment_config`).

## 5. Хранилища медиа

| Сценарий | Путь |
|---|---|
| Загрузка (S3-конфиг активен) | presigned PUT `anotee/{projectId}/{filename}` напрямую из браузера |
| Загрузка (нет S3) | Google Drive resumable upload → `Anotee.App/{Проект}/{Файл}` |
| Просмотр Drive | легаси `uc?export=download&confirm=t&id=...` (+ Fix Permissions при 403) |
| Просмотр S3 | presigned GET (TTL 1ч) через `storage?action=presign` |
| Аудио для Whisper (Drive) | через `proxyAudio` (SSRF-safe) |

## 6. i18n

- `i18next` + browser language detector; провайдер `services/i18n.tsx` (`useLanguage`).
- Полнота: en/ru — полные; **es/ja/ko/pt — 39/277 ключей** (fallback en), TASKS T-10.
- Клауд-синк настроек языка в Clerk metadata (`LanguageCloudSync`).

## 7. System Diagnostics (`/test`)

`components/TestRunner.tsx` + `services/testSuite.ts`. Запускается по URL `/test` или из админки. Подробности и целевое состояние — [`docs/TESTING.md`](TESTING.md).

## 8. Сборка

- Vite 5, `dist/` на Vercel; rewrites: `/api/*` → functions, остальное → `index.html` (`vercel.json`).
- Известное: главный чанк 817KB, воркер 877KB, ort-wasm 21.6MB копируется в dist даже без использования AI (TASKS T-11: manualChunks + lazy-загрузка воркера).
