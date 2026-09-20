# ISSUES.md — реестр проблем Anotee.app

> Ведётся вручную + обновляется `npm run audit`. Формат: ID | Приоритет | Статус | Место в коде.
> Приоритеты: **P0** блокирует пользователя · **P1** сбой/риск · **P2** качество/UX · **P3** техдолг.

| ID | Приоритет | Проблема | Место | Статус | Решение |
|----|-----------|----------|-------|--------|---------|
| ISS-001 | P0 | Краш «j is not a function» при загрузке видео | components/Player.tsx:1396 | ✅ fixed (2ce4d36) | Иконка MoreVertical отсутствует в lucide 0.469 → EllipsisVertical |
| ISS-002 | P0 | Цикл «Secret Key required» при сохранении BYOS | api/storage.js (config POST) | ✅ fixed (61bd73b, 63260e4) | Конкретное сообщение + подсказка; форма шлёт маску при отсутствии конфига |
| ISS-003 | P0 | Удаление слова не сохранялось (409 на маркер) | components/Player.tsx (syncCommentAction) | ✅ fixed (704f644) | Клиентский авто-ретрай при 409 |
| ISS-004 | P1 | iOS-загрузка >64 МБ обрывалась | hooks/useUploadManager.ts | ✅ fixed (74ca7a6) | Multipart-загрузка (32 МБ части). Нужен живой iOS-тест |
| ISS-005 | P1 | Зависшая загрузка не удалялась | hooks/useUploadManager.ts, Player upload-strip | ✅ fixed (704f644) | X для любого статуса + очистка незавершённых при старте страницы |
| ISS-006 | P1 | Плашка ИИ-транскрибации висела после 100%/ошибки | components/Player.tsx (runner-подписка) | ✅ fixed (704f644) | Безусловный сброс isTranscribing |
| ISS-007 | P1 | Чужая иконка источника (Drive → S3) | hooks/useUploadManager.ts:166 | 🟡 partial (bc53ed1) | Выбор Drive/S3 уважается; старые версии — кнопка «Починить источники видео» в BYOS (migrateStorage). Нажать 1 раз |
| ISS-008 | P1 | Сырые ключи в UI (34 пропущенных перевода) | services/locales/*.json | ✅ fixed (T-52) | Все ключи добавлены; защита: tests/unit/i18n-parity.test.ts |
| ISS-009 | P1 | e2e-флейк: Media Offline на внешнем демо-видео | tests/e2e/*, мок-данные | ✅ fixed (T-59) | installVideoMock + dispatchVideoLoadedMetadata в transcribe-flow и player-text-parity; прогон 2 passed |
| ISS-010 | P2 | 33 × alert/confirm вместо тостов | AdminTabs 12, Profile 13, Roadmap 3, Dashboard/Player/ProjectView 5 (confirm) | ✅ fixed-alerts (T-64) | 26 alert -> toast через toastBus (services/toastBus.ts); confirm оставлены нативными (нужен выбор да/нет) |
| ISS-011 | P2 | 15 × console.log в коде | components/*, api/* | 🟡 open | Чистка/обёртка debug-флагом (~30 мин) |
| ISS-012 | P2 | 4 × пустых catch | api/data.js:134,185,505; api/payment.js:93 | ✅ wontfix | Проверено вручную: все 4 — легитимные fallback-парсеры (JSON.parse строки, ожидаемая ветка); логирование создало бы шум |
| ISS-013 | P3 | 136 неиспользуемых ключей локалей (6 языков) | services/locales/*.json | ✅ fixed (96f89c3) | Удалено 308 дублей-ключей по всем языкам (динамических t() не найдено); i18n-parity тест защищает от повторения |
| ISS-014 | P3 | 5 хардкод-RU строк в JSX | components/* | 🟡 open | Перевод в i18n (~30 мин) |
| ISS-015 | P3 | 37 mock-ссылок | constants, services | ✅ решение юзера: демо-витрину оставить; TestRunner скрыт на проде (74ca7a6) | — |
| ISS-016 | P1 | 246K req/день → 75% лимита Vercel | App.tsx (polling), Cloudflare | ✅ fixed (9416079, c6a9396, 48703a2) | Polling 45с/30мин + сон при скрытой вкладке. Дополнительно: CF Cache Rule для /assets/ (действие владельца) |
| ISS-017 | P2 | Серверный _version-конфликт для комментариев (409) | api/data.js (comment route) | ✅ fixed (a0e93f0) | Retry-with-merge: при конфликте сервер перечитывает свежие данные и применяет ту же comment-операцию (last-write-wins, идемпотентно по id) |
| ISS-018 | P3 | Битые blob-ссылки после reload | components/Player.tsx | ✅ fixed (704f644) очистка; полное решение — IndexedDB | — |
| ISS-019 | P2 | BYOS: владелец конфига не показывался; маска секрета в кеше формы при отсутствии конфига | api/storage.js (GET config), components/Profile.tsx | ✅ fixed (a99052f) | configOwner в GET; очистка масок из кеша; user-id в ошибке 400 |

| ISS-020 | P0 | Краш «j is not a function» при первом открытии загруженного видео | рендер плеера | 🔵 user-action | 15.09 юзер прислал стек от СТАРОГО бандла BTVOE7AL (09.09) — по нему нельзя чинить текущий код. Нужен стек от сборки c605077+ (после снятия Vercel SSO-защиты манифеста и очистки данных сайта). Смягчение: ErrorBoundary + «Назад» | Причина: юзер тестировал билд e14b3a6 (сломанная типизация). Текущая голова ac851dd+ чистая (tsc/build/unit=0, crash-hunt e2e passed). Требуется: жёсткая перезагрузка + повтор; если повторится — прислать стек нового билда |

| ISS-021 | P1 | GET /api/storage?action=config -> 500 (сбой DDL/чтения новых таблиц в Neon) | api/storage.js | ✅ fixed (c605077) | T-97: per-provider чтение обёрнуто в try/catch, при сбое — fallback на legacy storage_config; switch_provider/POST тоже защищены; 500 более недостижим из этого пути | Нужны Vercel Function Logs (Runtime Logs) — вероятен сбой CREATE TABLE в транзакционном пуле Neon; откат: revert cc2213a |

| ISS-022 | P0 | Устройство юзера грузит устаревший бандл (BTVOE7AL). 15.09 подтверждено консолью: манифест фетчится через vercel.com/sso-api и блокируется CORS — Deployment Protection (SSO) мешает обновлению ассетов | Vercel Deployment Protection + кеш Safari | 🔵 user-action | Снять SSO-защиту для dev-домена (или исключение), проверить Deployments=Ready, очистить данные сайта. Критерий: манифест-хеш в консоли меняется после деплоев | Safari: Настройки → Данные сайтов → dev.anotee.com → Удалить; затем жёсткая перезагрузка. Проверить Vercel → Deployments: последний коммит = Ready. После этого в консоли должен появиться НОВЫЙ manifest-хеш |

## Известные ограничения среды песочницы

- voice.spec: 1 падение из 2 — page.goto timeout 60с (dev-сервер cold start в песочнице), не код приложения; в повторном прогоне той же спеки 1 passed.
- Полный прогон всех 24 тестов в песочнице >20 мин (voice/PTT требуют микрофон) — запуск локально/на CI.

## Сессия 2026-09-16…20: T-104…T-112 — устойчивость хранилища, плеер, мобильная шапка

| # | Коммит | Суть |
|---|--------|------|
| T-104 | d551c93 | /api/storage: «не настроено» отдаётся 400 (было 500); чтение конфига — last-resort без 500 (закрывает ISS-021-класс для конфигов) |
| T-105 | d551c93 | Мастер: обязательные Endpoint URL и Бакет + подсказка «чего не хватает» (кнопка ждёт заполнения) |
| T-106 | d551c93 | Логотипы пользователя (logo.svg/logo.png из корня) добавлены в public/ без изменений (правило: бренд не трогать) |
| T-107 | d551c93 | Виджет загрузки: таймаут финальной синхронизации (20с → «синхронизируется в фоне») + watchdog на зависание 100% (25с) |
| T-108 | 09248c3 | Мобильная шапка плеера: второстепенные иконки убраны, переключатель вида — в меню «⋯» (mobile-more-viewmode) |
| T-109 | 09248c3 | Локали: ключи player.more.viewmode.* (ru/en) — i18n-parity зелёный |
| T-110 | 09248c3 | .eslintignore: исключены test-results/dist/playwright-report (артефакты Playwright ломали lint) |
| T-111/112 | 09248c3 | e2e обновлены под новый UX (endpoint в мастере, view-меню через «⋯»); touch-gestures 6/6, wizard-flow зелёные |

Проверки на 09248c3: tsc 0 · verify 0 (lint+unit 60/60+audit 5/5) · e2e: touch-gestures 6/6, wizard-flow, player, parity — passed.

## Сессия 2026-09-15 (вторая): T-92…T-97 — единый блок провайдеров и стабильность

| # | Коммит | Суть |
|---|--------|------|
| T-92 | 0963415 | Блок «Хранилища»/мастер вынесен из help-модалки (рендерился только при открытой модалке) — e2e wizard-flow снова зелёный |
| T-93 | 2f54d08 | Единый блок «Провайдер Хранилища»: 5 карточек (Google/Yandex/R2/Selectel/Custom) со статусами и переключением активного в один клик; Backblaze убран из UI; per-provider конфиги (новая таблица storage_configs, legacy зеркалится); reset_config реализован на сервере (раньше action не существовал!); «Починить источники (Drive)» и «Сброс» — в «Сервисных действиях»; макет DELIVERY/V1 Anotee-Хранилище-единый-блок.html |
| T-94 | b42a0a6 | Микрофон: явный системный запрос getUserMedia перед распознаванием во всех 4 сценариях диктовки |
| T-95 | c902076 | Редактор слов: удаление не расползается на соседние слова (критерий «центр слова в диапазоне удаления» вместо ±EPS-перекрытия); регресс-тест; подтверждённый механизм жалобы юзера |
| T-96 | 0aaff34/bdf2216 | Secret Access Key: явный saved-state («сохранён»), понятная маска, placeholder о смене ключей |
| T-97 | c605077 | /api/storage config GET/POST/switch не падают 500-м при сбоях storage_configs (ISS-021-паттерн) — fallback на legacy |

## Сессия 2026-09-15: UX-пакет T-85…T-91 (ветка chore/multiagent-prep)

| # | Коммит | Фикс |
|---|--------|------|
| T-85 | 4d68a63 | Восстановлены сломанные state/handleResetConfig в Profile.tsx (сборка снова зелёная) |
| T-86 | 2dea566 | ErrorBoundary: кнопка «← Назад» (history.back) рядом с «Обновить страницу»; старт чистки UX |
| T-88 | c5ce7f5 | Сброс конфига чистит оба поля (secretAccessKey + accessKeyId); баннер no-config скрывается после успешного Save/Test; после успеха снимаются noConfigFound/secretBroken |
| T-89 | 301a033 | safe-area (env(safe-area-inset-*)) применяется всегда, а не только в PWA-standalone — шапка не уезжает под динамический остров |
| T-90 | a8cfcbe | Микрофон: при отказе показывается конкретная инструкция (iOS Настройки → Safari/Anotee; ПК — замок у адреса) в ru/en локалях |
| T-91 | f57ad3a | Codex P2: .safe-top сохраняет базовый py-2 шапки (calc + 0.5rem) и не добавляет лишние 8px на md (py-0 baseline) |

Открытые: нижняя PWA-навигация (ожидает выбора дизайн-варианта), лоадер «видео готовится» вместо краша при свежей версии (ждём sourcemap-стек «j is not a function»), режим «вставить только Token value», IndexedDB-кэш.

## Проверенные зоны аудита (`npm run audit`)

| Зона | Объём | Найдено |
|------|-------|---------|
| components/*.tsx (21 файл) | i18n-ключи, alert/confirm, хардкод-RU, mock-ссылки | alert 33, mock 37, хардкод 5 |
| api/*.js | пустые catch, console.log | 4 + 15 |
| services/locales/ru.json + en.json | missing/unused ключи | 0 missing (было 34), 140 unused |
| services/*.ts | TODO/FIXME, ts-ignore, dangerouslySetInnerHTML | 0 / 0 / 0 |
| tests/unit + tests/e2e | покрытие найденных проблем | i18n-parity (3 кейса), player-text-parity e2e |
| Mobile UI (Player) | вёрстка, шапка, док-иконки | T-40–T-47, проверено e2e |
| Storage (BYOS + upload) | секрет-цикл, multipart, миграция | T-39a/T-44/T-45/T-47 |
| Cloudflare (коннектор) | трафик, бакет, юрисдикция | 246K req/день, 99,6% dev, бакет anotee (Default) |
