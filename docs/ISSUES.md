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
| ISS-009 | P1 | e2e-флейк: Media Offline на внешнем демо-видео | tests/e2e/*, мок-данные | 🟡 open | Предложено: локальная видеозаглушка в public/ для mock-режима |
| ISS-010 | P2 | 33 × alert/confirm вместо тостов | components/* | 🟡 open | План: замена на Toast-компонент (механическая, ~2 ч) |
| ISS-011 | P2 | 15 × console.log в коде | components/*, api/* | 🟡 open | Чистка/обёртка debug-флагом (~30 мин) |
| ISS-012 | P2 | 4 × пустых catch (ошибки проглатываются) | api/data.js:134,185,505; api/payment.js:93 | 🟡 open | Логирование в каждый catch (~30 мин) |
| ISS-013 | P3 | 136 неиспользуемых ключей локалей | services/locales/*.json | 🟡 open | Чистка после i18n-теста (~30 мин) |
| ISS-014 | P3 | 5 хардкод-RU строк в JSX | components/* | 🟡 open | Перевод в i18n (~30 мин) |
| ISS-015 | P3 | 37 mock-ссылок | constants, services | ✅ решение юзера: демо-витрину оставить; TestRunner скрыт на проде (74ca7a6) | — |
| ISS-016 | P1 | 246K req/день → 75% лимита Vercel | App.tsx (polling), Cloudflare | ✅ fixed (9416079, c6a9396, 48703a2) | Polling 45с/30мин + сон при скрытой вкладке. Дополнительно: CF Cache Rule для /assets/ (действие владельца) |
| ISS-017 | P2 | Серверный _version-конфликт для комментариев | api/data.js (comment route) | 🟡 open | Предложено: убрать strict-lock для comment-роута (last-write-wins) |
| ISS-018 | P3 | Битые blob-ссылки после reload | components/Player.tsx | ✅ fixed (704f644) очистка; полное решение — IndexedDB | — |

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
