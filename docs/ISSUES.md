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

| ISS-020 | P0 | Краш «j is not a function» на билде fzOmaWTN (09:03) при загрузке видео | useUploadManager | 🟡 pending-user-retest | Причина: юзер тестировал билд e14b3a6 (сломанная типизация). Текущая голова ac851dd+ чистая (tsc/build/unit=0, crash-hunt e2e passed). Требуется: жёсткая перезагрузка + повтор; если повторится — прислать стек нового билда |

| ISS-021 | P1 | GET /api/storage?action=config -> 500 после добавления storage_prefs/audit таблиц | api/storage.js (config GET + lazy DDL) | 🟡 open | Нужны Vercel Function Logs (Runtime Logs) — вероятен сбой CREATE TABLE в транзакционном пуле Neon; откат: revert cc2213a |

| ISS-022 | P0 | Устройство юзера грузит устаревший бандл: манифест BTVOE7AL не меняется с 09.09 при ~20 деплоях — все фиксы недели не активны на устройстве (маска в Save, Drive-роутинг, нет честного CORS) | Кеш Safari для dev.anotee.com (SSO-wrapped ассеты) ИЛИ неуспешные/остановленные деплои Vercel | 🔵 user-action | Safari: Настройки → Данные сайтов → dev.anotee.com → Удалить; затем жёсткая перезагрузка. Проверить Vercel → Deployments: последний коммит = Ready. После этого в консоли должен появиться НОВЫЙ manifest-хеш |

## Известные ограничения среды песочницы

- voice.spec: 1 падение из 2 — page.goto timeout 60с (dev-сервер cold start в песочнице), не код приложения; в повторном прогоне той же спеки 1 passed.
- Полный прогон всех 24 тестов в песочнице >20 мин (voice/PTT требуют микрофон) — запуск локально/на CI.

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
