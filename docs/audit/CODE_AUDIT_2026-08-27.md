# Аудит кода Anotee.app — 2026-08-27

## 1. Резюме

Аудит веб-сервиса ревью видео Anotee.app (React 19 + Vite 5 + TS strict, Clerk, Vercel serverless, Vercel Postgres, Google Drive/S3, ЮKassa/Prodamus, i18next, Whisper в браузере). Проверены API-слой (`api/*.js`), синхронизация фронтенда (Smart Polling/SWR), мобильный UI, i18n, мёртвый код и System Diagnostics.

**Ключевые выводы:** (1) webhook ЮKassa и Prodamus не проверяют подпись — оплату можно подделать одним POST-запросом (факт, P0); (2) GET-список проектов организации в `api/data.js` не проверяет членство в орг-структуре — IDOR на все проекты любой орг-структуры (факт, P0); (3) мастер-ключ шифрования S3-секретов имеет захардкоженный публичный фолбэк (факт, P0); (4) в POST-sync потеря обновления при CAS-конфликте происходит молча, клиенту возвращается ложный успех с неверной версией (факт, P1); (5) комментарий шлётся дважды (весь проект + отдельный эндпоинт) — возможны дубликаты (candidate, P1); (6) роли `viewer`/restricted не проверяются в PATCH/POST — участник может перезаписать весь JSON проекта (факт, P1); (7) i18n: es/ja/ko/pt покрывают только 39 из 277 ключей (86,6 % отсутствует), fallback — английский; (8) управление проектами на тач-устройствах скрыто за `group-hover:opacity-0` — функционально недоступно; (9) `npx tsc --noEmit` падает (4 ошибки) — подтверждено повторным прогоном; (10) System Diagnostics содержит тавтологичные тесты, дающие ложные «зелёные» без проверки реального кода.

**Методика и границы:** только чтение исходников + повторный запуск `npx tsc --noEmit` (read-only) и Node-скрипт сравнения JSON локалей. Ни один файл, кроме настоящего отчёта, не изменялся и не должен изменяться. Все утверждения снабжены `файл:строка`; непроверенные динамически утверждения помечены «candidate». Строки нумерация — по текущему состоянию репозитория на момент аудита.

---

## 2. Таблица топ-рисков

| ID | Риск | Крит. | Файл:строка | Статус | Влияние | Решение | Усилия |
|----|------|-------|-------------|--------|---------|---------|--------|
| R01 | Webhook ЮKassa/Prodamus без проверки подписи — подделка оплаты | **P0** | api/payment.js:41-114, 237-263 | факт | Любой может бесплатно получить `plan: lifetime` | Валидация по IP ЮKassa (139.177.188.0/24 и др.), обратный запрос платежа `GET /v3/payments/{id}` с сверкой `amount/metadata`; Prodamus — проверка HMAC-подписи `sign`; двойная проверка `userId` и суммы на сервере | S |
| R02 | GET списка проектов орг-структуры без проверки членства (IDOR) | **P0** | api/data.js:361-368 | факт | Любой авторизованный читает все проекты любой org_id | Проверка `userOrgIds.includes(targetOrgId)` (как в check_updates, data.js:118) + sanitize | S |
| R03 | Захардкоженный фолбэк мастер-ключа шифрования | **P0** | api/_crypto.js:6 | факт | При отсутствии `CLERK_SECRET_KEY` S3-секреты шифруются публично известным ключом; AES-CBC без HMAC | Явный fail-fast при отсутствии ключа; отдельный `ENCRYPTION_KEY` из env; переезд на AES-GCM | S |
| R04 | Удаление чужих объектов: delete_assets (blob) и delete/delete_folder (S3) не проверяют принадлежность URL/ключей проекту | **P1** | api/data.js:204-232; api/storage.js:226-282 | факт | Участник проекта A удаляет blob/S3-файлы проекта B (и даже весь бакет владельца, prefix='') | Whitelist префиксов `anotee/{projectId}/`; сверка ключей с данными проекта; ограничение prefix | M |
| R05 | POST-sync: CAS-конфликт не проверяется по rowCount — ложный `status:'updated'`, потеря правок + рассинхрон `_version` | **P1** | api/data.js:487-493 | факт | Два клиента пишут проект целиком → правки молча теряются; клиент получает несуществующую версию | Проверять `updateResult.rowCount`; отдавать 409 и серверную версию (как в comment/PATCH) | S |
| R06 | Комментарий пишется дважды (весь проект + comment-endpoint) без дедупликации по id → дубли | **P1** | components/Player.tsx:509-525 + api/data.js:165 | candidate | Рандомная гонка плодит дубликаты комментариев в БД; `_version` расходится | Использовать только comment-endpoint (CAS); либо `ON CONFLICT` по id; сериализовать запись | M |
| R07 | Роль участника не проверяется: `viewer` (и любой member без restrictedAssetId) перезаписывает весь JSON проекта через POST/PATCH, включая `team`, `name`, `publicAccess` | **P1** | api/data.js:417-456, 459-509 | факт | Эскалация: приглашённый по ссылке reviewer может изменить владельца/настройки/ассеты | Серверная проверка роли (owner/org:admin) для PATCH/POST; запрет на ключи `team/ownerId/orgId/publicAccess` не-владельцам | M |
| R08 | Hover-only управление: lock/edit/share/delete карточки проекта и ассета невидимы и недостижимы на тач-экранах | **P1** | components/Dashboard.tsx:443-474; components/ProjectView.tsx:679-715, 920 | факт | На телефоне нельзя редактировать/делиться/удалять проекты и ассеты | Всегда видимые кнопки на < md, либо контекстное меню/длинное нажатие | S |
| R09 | SpeechRecognition: жёсткий `lang='en-US'`, нет onerror, одна фраза за нажатие, модалка только с клавиатуры | **P1** | components/Player.tsx:737-755, 487-488, 293-295 | подтверждено | Русская речь транскрибируется как английская; тихий отказ микрофона; недоступность на тач | См. раздел 4 (верифицированные находки) | M |
| R10 | Платёжные секреты в БД открытым текстом и отдаются админу целиком; master-key смешивается с CLERK_SECRET_KEY | **P1** | api/admin.js:591-595, 32-33; api/_crypto.js:4-6 | факт | Утечка БД/компрометация админ-аккаунта = платёжные ключи; ротация Clerk-ключа ломает дешифровку | Шифровать payment_config через `_crypto`; не возвращать `secretKey` клиенту; отдельный ключ шифрования | M |
| R11 | Cron: при отсутствии `CRON_SECRET` валидный заголовок — строка `Bearer undefined`; списание фиксированных 2900 ₽; только первые 100 пользователей | **P1** | api/cron.js:8, 20, 58 | candidate (зависит от env) | Угадываемый «секрет», неверная сумма, пропуск пользователей за 100-м | Fail-fast при отсутствии env; сумма из конфига; пагинация getUserList; идемпотентность | M |
| R12 | i18n: es/ja/ko/pt содержат 39 из 277 ключей; десятки захардкоженных строк мимо t() | **P1** | services/locales/{es,ja,ko,pt}.json; Player.tsx:740,758; ProjectView.tsx:792-815; Profile.tsx:503-876 | факт | Пользователи RU-альтернативных локалей видят английский/русский вперемешку | Дополнить словари (генератор по en); вынести строки в t(); CI-проверка целостности ключей | L |
| R13 | `tsc --noEmit` падает; `npm run build` не запускает tsc (только vite build) | P1 | App.tsx:638,684; Dashboard.tsx:133; transcriptionWorker.ts:18; package.json (scripts) | подтверждено | Типовые ошибки не ловятся в CI; прод-сборка собирается из кода с ошибками типов | Исправить 4 ошибки; добавить `tsc --noEmit` в build/CI | S |
| R14 | `hidden md:block` убирает функциональность на телефоне: сравнение версий (single/compare) | **P1** | components/Player.tsx:861-864 (и 843-848) | подтверждено | На телефоне нет функции сравнения версий | Показать кнопку на всех размерах или в нижней панели | S |
| R15 | FloatingControls `z-[9999]` поверх всех модалок | P2 | components/Player.tsx:277 | факт | Панель висит над VoiceModal/селектором версий и т.п. | z-индекс ниже модальных слоёв (z-50..z-100) | S |
| R16 | Публичные эндпоинты admin: get_version/get_domains без auth; get_payment_config не-админу отдаёт shopId | P2 | api/admin.js:64-92, 35-39 | факт | Утечка конфигурации (не критично, но ненужно) | Ограничить или удалить | S |
| R17 | `user-scalable=no, maximum-scale=1` | P2 | index.html:6 | подтверждено | Блокировка зума (доступность) | Убрать ограничения масштаба | S |
| R18 | Webhook-тест в testSuite ожидает 400, а сервер отвечает 200 | P2 | services/testSuite.ts:129-143 + api/payment.js:70-74 | факт | Диагностика врёт о валидации вебхуков (и при этом вскрывает её отсутствие) | Переписать тест под реальное поведение/подпись | S |

---

## 3. Разделы A–F

### A. API-слой

#### A.1 Матрица эндпоинтов (файл, метод+action, проверка токена, роль/владелец, валидация)

**`api/data.js`** — единый handler, маршрутизация по `action` и методу:

| Метод+action | Токен | Роль/владелец | Валидация входа |
|---|---|---|---|
| GET `drive_token` (74-97) | `verifyUser(req, requireEmail=true)` (62-63) | `user.isVerified` (75) | — |
| GET `check_updates` (102-134) | verifyUser | org: `userOrgIds.includes(targetOrgId)` (118); personal: owner или `data->team @> [{id}]` (121-131) | — |
| POST `comment` (139-199) | verifyUser | `checkProjectAccess` (153); для update/delete — владелец комментария или проекта (170-183) | обязательные поля (144); **payload не валидируется** (165: спредится целиком); CAS по `_version` (187-197) — единственный путь с честным 409 |
| POST `delete_assets` (204-232) | verifyUser | `checkProjectAccess` + owner или org:admin/org:member (217-228) | `urls, projectId` (208); **urls не сверяются с проектом** (230: `await del(urls)`) |
| DELETE `?projectId` (239-268) | verifyUser | owner (id или email) или org:admin (250-262) | projectId (241) |
| GET список/single/org (271-414) | verifyUser | single: `checkProjectAccess` (289) + авто-join по invite/review (299-343) или `publicAccess==='view'` (350); **org list: НЕТ проверки членства** (361-368); personal list: owner/team/email (373-389) | —; sanitize для restricted (16-57), **для org list не применяется** (364-368 → 398-404) |
| PATCH (417-456) | verifyUser | `checkProjectAccess` (425); restricted не может менять `name/team/publicAccess` (430-433); **роль `viewer` не проверяется** | `projectId, updates` (419); `_version` сравнивается только если передан (438-440); UPDATE без CAS в WHERE (449-453) |
| POST sync (459-509) | verifyUser | per-project `checkProjectAccess` (480); restricted пропускается (484-485); **viewer не проверяется** | `_version` берётся с клиента (469-471); UPDATE с CAS в WHERE (491), **rowCount не проверяется** (487-493) |

**`api/payment.js`**:
- POST webhook (41-114): **без токена, без подписи** (см. A.2). Обнаружение по телу (42-51) или `?action=webhook` (54). GET → 200 `{status:'online'}` (58-60).
- POST `init` (117-212): `verifyUser` (121-122); валидация плана по конфигу; YooKassa init с Basic-авторизацией (154-171), Prodamus init (188-197).
- POST `cancel_sub` (215-225): `verifyUser`.
- CORS `*` (29).

**`api/admin.js`**:
- `get_payment_config` (13-45): auth не обязателен; админ получает **весь rawConfig, включая `yookassa.secretKey` и `prodamus.secretKey`** (32-33); не-админ — `shopId` + `url` (35-39).
- `get_config` (50-61): требуется verifyUser.
- `get_version` (64-72), `get_domains` (75-92): **публичные, без auth**.
- Все остальные (94-612): `verifyUser` (96-99) + Clerk `publicMetadata.role ∈ {admin, superadmin}` (104-116). Список action: `get_ai_config`, `update_ai_config` (ключ шифруется, 149), `generate_meta_prompt`, `generate_ai`, `generate_image`, `setup`, `migrate`, `users`, `set_plan`, `grant_pro`, `revoke_pro`, `toggle_admin`, `update_config`, `update_payment_config` (**секреты в БД открытым текстом**, 591-595), `update_version`, `update_domains`. `setup` выполняется только админом, несмотря на комментарий «protected by secret param» (382-384) — параметра нет.

**`api/storage.js`**: все действия — `verifyUser` (15-18). `getContextS3` (23-46): при наличии `projectId` проверяет `checkProjectAccess` и переключается на **креды владельца проекта**. Actions: `config` GET (секрет маскируется, 80) / POST (шифруется, 95-96; при `***` сохраняет старый, 98-103), `test` (126-147), `configure_cors` (150-183, AllowedOrigins `*` — 164), `presign` (186-223, операции put/get на **любой key**), `delete` (226-247, **keys без проверки принадлежности**), `delete_folder` (250-282, **любой prefix, включая `''` → весь бакет**).

**`api/upload.js`**: `handleUpload` (Vercel Blob), токен и projectId из `clientPayload` (26-29), `getUserFromToken` (32-36), `checkProjectAccess` (46-49); allowlist `video/*`, лимит 450 МБ (59-60). Ограничение: только видео — аудио/изображения через этот путь не пройдут.

**`api/cron.js`**: заголовок `Authorization: Bearer ${CRON_SECRET}` (7-10). При отсутствии env — валидный заголовок `Bearer undefined` (candidate, зависит от деплоя).

**`api/health.js`** — публичный `status:'ok'`. **`api/proxyAudio.js`** — публичный; SSRF-барьер: regex-извлечение file ID + `url.includes('drive.google.com')` (13-26); fetch только на `drive.google.com/uc` (26). Остаточный риск: `includes()` проходит для `https://evil.com/?u=drive.google.com`, но URL строится заново — фактического SSRF нет, можно лишь скачивать публичные Drive-файлы.

#### A.2 Webhook ЮKassa/Prodamus — проверяется ли подпись?

**Вывод: подпись/секрет уведомления НЕ проверяются — оплату можно подделать. ФАКТ.**

- ЮKassa (payment.js:68-86): достаточно `body.type === 'payment.succeeded'` (42). Ни сверки `signature`-заголовка (у ЮKassa их нет — но должна быть проверка IP-адреса и/или обратный запрос `GET /v3/payments/{payment.id}`), ни сверки суммы. `upgradeUser` (237-263) начисляет `plan:'pro'`/`lifetime`, при `amount >= 2000` — lifetime (249).
  Эксплойт: `POST /api/payment` с телом `{"type":"payment.succeeded","object":{"metadata":{"userId":"user_2XXX","planType":"lifetime"},"amount":{"value":"99999.00"}}}` → жертва получает lifetime.
- Prodamus (89-107): проверяется только `payment_status === 'success'` (46) или `content-type: x-www-form-urlencoded` с `payment_status`. Поля `sys.userId/planType` читаются из тела (97-99). В Prodamus есть поле подписи `sign` (HMAC-SHA256 от секрета) — оно **игнорируется**.
  Эксплойт: `POST /api/payment` с `payment_status=success&sys={"userId":"user_2XXX","planType":"lifetime"}`.
- Усугубление: CORS `*` (29) и то, что webhook-детект работает и по query `?action=webhook` (54); любые ошибки обработки глушатся и возвращают 200 (109-113) — маскирует злоупотребление в логах.

#### A.3 admin.js — защита

Факт: все строго админские действия за проверкой `verifyUser` + роль (admin/superadmin) в Clerk (95-116). Исключения: `get_version`/`get_domains` публичны (64-92); `get_payment_config` — гибрид (13-45); `setup` — под админской проверкой (382-394). `toggle_admin` запрещает менять свой статус (569), но любой админ может сделать админом любого другого пользователя (566-582) — разграничения superadmin нет.

#### A.4 storage.js / upload.js — утечка секретов S3 и права на presign

- Факт: секрет шифруется при сохранении (storage.js:95-96) и маскируется при GET (80). Но мастер-ключ — `CLERK_SECRET_KEY` с публичным фолбэком (_crypto.js:6) — см. R03.
- Факт: `presign`/`delete`/`delete_folder` проверяют доступ к проекту (getContextS3, 23-46), но **ключи/префиксы не ограничены проектом**: участник проекта A получает креды владельца и может подписать GET/PUT/удалить любой ключ в бакете владельца, включая чужие проекты владельца (presign 186-223; delete 226-247; delete_folder 250-282). Влияние ограничено бакетом владельца, но не проектом.
- upload.js: токен Clerk пересылается в `clientPayload` (26-28) — утечка токена в логах возможна (Vercel Blob логирует payload?) — low/candidate.

#### A.5 cron.js — защита от не-Vercel запуска

Факт: есть `Bearer ${CRON_SECRET}` (8). Кандидат: при отсутствии env валидным становится литерал `Bearer undefined`; также списание жёстко `2900.00 RUB` (58) и только первые 100 пользователей (`getUserList({limit:100})`, 20) — автопродление не масштабируется.

#### A.6 data.js — read-modify-write всего JSON проекта

- Факт: проекты хранятся одним JSONB-документом; POST sync пишет **весь документ** (487-492). Конкурентная запись двух клиентов: SELECT (477) → UPDATE с CAS `data->>'_version'` (491). **Но `updateResult.rowCount` не проверяется** — если другой клиент успел записать, правка молча отбрасывается, а в ответ уходит `{status:'updated', _version: newVersion}` (493) с версией, которой в БД нет. Клиент продолжает работать с «будущей» версией → следующие записи с этого клиента будут всегда проигрывать CAS.
- PATCH (417-456): конфликт проверяется только при наличии `_version` в теле (438), и UPDATE не содержит CAS в WHERE (449-453) — окно между SELECT (421) и UPDATE (449) теряет правки (TOCTOU).
- comment (139-199): полноценный CAS (194) — единственный честный конфликтный путь (409, 197).
- Версионирование: `_version` — просто счётчик без истории/merge; авто-join в GET (338-342) пишет БД «fire-and-forget» без CAS — может затереть параллельную правку (побочный эффект: бамп `updated_at` на каждый чужой визит).

#### A.7 `api/_crypto.js:6` — последствия фолбэка

```js
const MASTER_SECRET = process.env.CLERK_SECRET_KEY || 'default-fallback-secret-key-do-not-use-in-prod';
```
Факт: (1) при misconfigured-деплое (нет `CLERK_SECRET_KEY`) все шифруемые секреты (S3 secretAccessKey, OpenAI key) шифруются **публично известным** ключом — утечка БД = полный доступ к хранилищам пользователей; (2) master-ключ общий с Clerk-аутентификацией: компрометация ключа верификации токенов даёт и расшифровку секретов, ротация Clerk-ключа ломает дешифровку старых данных; (3) AES-256-CBC без HMAC (malleability), ключ = `sha256(secret)` без соли/KDF. Плюс несоответствие: payment_config (секреты ЮKassa/Prodamus) в БД хранится открытым текстом (admin.js:591-595) и целиком возвращается админу (32-33).

### B. Синхронизация фронтенда

Механика: SWR (`useSWR`, App.tsx:190-196) с `refreshInterval: 15000` при активном плеере / `300000` в покое (188), `dedupingInterval: 5000`, `revalidateOnFocus`. Данные мержатся в локальный стейт эффектом (199-236):

- Guard `Date.now() - lastLocalUpdateRef.current < 2000` (201) — 2-секундное окно после локальной правки; `lastLocalUpdateRef` выставляется в `forceSync` (390) и на 60 секунд вперёд при загрузке (useUploadManager.ts:75). После окна ответ опроса может перезаписать локальную правку, если она ещё не долетела (серверная версия старше) — UI «откатывает» комментарий, а затем sync-ответ (в котором правка есть) только поднимает `_version` (397-400) — визуальный откат, candidate.
- Хэш-сравнение только по `id:_version` (204-205): **конфликт контента при одинаковой версии не обнаруживается** — правка одного клиента бесшумно заменяется версией другого, если обе стартовали с одной `_version` (факт).
- Сохраняются только `blob:` локальные файлы (219-222); `localFileUrl` после первой же серверной перезаписи теряется для не-blob источников.
- Комментарий: `syncCommentAction` (Player.tsx:509-525) делает **двойную запись**: (а) `onUpdateProject` → `forceSync` → `api.syncProjects` (весь проект, POST, fire-and-forget, не awaited) и (б) `api.comment` (CAS-endpoint, awaited). Гонки:
  1. Если `api.comment` успевает раньше sync: sync-запись падает по CAS **молча** (data.js:491-493) → итог корректен, но клиент получает ложный `updated` (R05).
  2. Если sync успевает раньше: `api.comment` читает уже обновлённый документ (версия N+1) и **повторно пушит комментарий с тем же id** (data.js:165, без dedup) → дубликат в БД (candidate, R06).
- Очереди/дедупликации нет: `handleBulkResolve` (Player.tsx:735) порождает N параллельных полных POST + N comment-запросов без сериализации; `handleEditProject` (App.tsx:452-458) и `handleUpdateProject` (447-450) синкают весь проект на каждое изменение.
- Обработка 409: `apiClient.ts:141-146` бросает `CONFLICT` только на HTTP 409, но **POST sync никогда не отдаёт 409** (всегда 200) — ветка `forceSync` (App.tsx:404-407) недостижима для sync-пути (факт). PATCH-конфликт обрабатывается в Dashboard (199-203) — единственное место с честным UX конфликта.
- Следствие R07: PATCH/POST не проверяют роль — см. A.1.

### C. Мобильный UI-скан

Факты (hover-only, без touch-альтернативы — функциональность недостижима на телефоне):
- Dashboard.tsx:443-474 — кнопки lock/edit/share/delete карточки: `opacity-0 group-hover:opacity-100`; нет long-press/меню. Проект нельзя ни отредактировать, ни поделиться, ни удалить с телефона.
- Dashboard.tsx:526-530 — подсказка лимита `opacity-0 group-hover:opacity-100 pointer-events-none`.
- ProjectView.tsx:679-715 — share/add-version/delete ассета `opacity-0 group-hover:opacity-100`; ProjectView.tsx:920 — удаление участника `opacity-0 group-hover:opacity-100`.

`hidden md:block`/`md:hidden`, убирающие функциональность (не просто стиль):
- Player.tsx:861-864 — переключатель вида single/side-by-side в `hidden md:block` (и кнопка «Compare» — 843-848) → на телефоне нет сравнения версий (подтверждено, R14).
- Player.tsx:293-295 — кнопка Mic в FloatingControls видна только при `isFullscreen` (подтверждено).
- Player.tsx:811 — `window.innerWidth > 768` прямо в рендере (устаревает при повороте; подтверждено).
- Dashboard.tsx:493,512 — заголовок `hidden lg:flex` + пустой компенсатор — только стиль, функциональность не страдает.
- ProjectView.tsx:463,472,488,497,507,515 — StorageIndicator: на мобильном остаётся иконка, функциональность не теряется.

safe-area-inset: только Player.tsx:992 — нижняя панель комментариев имеет `pb-[env(safe-area-inset-bottom)]` (хорошо). Без safe-area: AppHeader мобильное меню, нижняя строка `pb-6` (AppHeader.tsx:292); UploadWidget `fixed bottom-4` (App.tsx:52); FloatingControls (Player.tsx:277).

Модалки/вьюпорт: все модалки центрированы `fixed inset-0 flex items-center justify-center p-4` (Dashboard 599-639, 642-670, 673-771; ProjectView 733-757, 761-949; Profile 896-959). `max-h` есть у OrgSettings (`max-h-[90vh]`, ProjectView.tsx:954) и help-модалок (`max-h-[90vh]`/`max-h-64`); у остальных нет — на малых высотах (ландшафт телефона) контент может обрезаться (candidate, low).

z-index конфликт: FloatingControls `fixed z-[9999]` (Player.tsx:277) — выше всех модалок (VoiceModal z-50 в контейнере `fixed inset-0 z-[100]` при fullscreen, 871/893; селектор версий z-[100]/z-[90], 824/837; UploadWidget z-[100], App.tsx:52; header z-50). Панель IN/OUT/Mic висит поверх модальных оверлеев (факт по классам, R15).

Таблицы: AdminUsersTab.tsx:162-163 — `<div className="overflow-x-auto"><table>` (ок); вкладки AdminPanel — `overflow-x-auto min-w-max` (AdminPanel.tsx:50-51, ок).

### D. i18n

Сравнение ключей (Node-скрипт, флэттенинг JSON по «.»): en=277, ru=282, es=ja=ko=pt=39.

| Локаль | Всего ключей | Отсутствует vs en (277) | Отсутствует vs ru (282) |
|---|---|---|---|
| ru | 282 | 1 (`footer.rights`) + 6 лишних (`page.about.val.*`) | — |
| es | 39 | **240 (86,6 %)** | 245 |
| ja | 39 | **240** | 245 |
| ko | 39 | **240** | 245 |
| pt | 39 | **240** | 245 |

Примеры отсутствующих: `loading`, `cancel`, `save`, `delete`, `edit`, `logout`, `back`, `nav.roadmap`, `player.*`, `pv.*`, `dash.delete_confirm`, `upsell.*` (для es/ja/ko/pt). `fallbackLng: 'en'` (i18n.config.ts:23) — неполные локали показывают английский; `keySeparator:false` — ключи с точками хранятся плоско.

Захардкоженные строки мимо `t()` — масштаб (метод: подсчёт регулярками по 12 основным компонентам):
- `t('…')` вызовов: **104**;
- JSX-текст-литералы (текстовые узлы `>Text<` с буквами, длина ≥ 2): **≈177**;
- строковые литералы в `notify(...)`: **54**;
- строковые литералы в `alert(...)`/`confirm(...)`: **23**.

Примеры: Player.tsx:740 `"Speech recognition not supported in this browser."`; Player.tsx:758 `"In Point Set"`; Player.tsx:920-951 — экраны S3/Drive ошибок (`S3 Connection Error`, `File Deleted from Drive`, `Check S3 Settings`, `Remove Version from App`, `Go Back`); PlayerSidebar:120 `Transcript`, 177-178, 183, 187 (`AI Transcription`, `Generate Transcript`, `Processing Audio...`); ProjectView.tsx:792-815, 862-897 — share-модалка целиком на английском (`Client Review`, `Invite Team`, `Public Access`, `Full access to edit, upload…`); Dashboard.tsx:687-749 — та же share-модалка; Profile.tsx:503-876 — S3-блок и модалки на русском (`Провайдер Хранилища`, `Подключить Google Drive`, `Проверить`, `Активировать…`, `Скопировано!`, `Найти старые проекты`); AppHeader.tsx:219,243,248,293 — мобильное меню (`Показать обучение`, `Профиль и Подписка`, `Организация`, `Язык интерфейса`); AdminPanel/admin-табы — полностью без t() (0 вызовов), 73+ текстовых узлов.

### E. Мёртвый код и точки распила

- **App.tsx:638/684** — `onLoginRequest={() => setIsAuthModalOpen(true)}`: состояния `isAuthModalOpen` в `AppLayout` нет (есть только `isCreateModalOpen`, 157). Это остаток удалённой модалки логина; JSX-проп дошёл до статической страницы Roadmap, которая требует `onLoginRequest` (Roadmap/RoadmapPage.tsx:13-16, вызывается в 25/127/142; PostDetailModal.tsx:17,96). Чинить: восстановить реальный обработчик — например `const { openSignIn } = useClerk(); … onLoginRequest={() => openSignIn()}` (Clerk-модалка) или навигацию на логин; вариант «просто удалить проп» не проходит, т.к. RoadmapPage обязан его принять.
- **i18n.legacy.ts** — 5 строк, сам помечен `// DEPRECATED … safe to delete`; `LEGACY_DICTIONARIES` нигде не импортируется (grep). Удалить.
- **Неиспользуемые экспорты**: `api.checkUpdates` (apiClient.ts:51) — ни одного вызова; `getPlanDescription` (planLabels.ts:33) — не используется (`getPlanIcon` используется в AdminUsersTab). `MOCK_PROJECTS`/`STORAGE_KEY` используются только в mock-ветках apiClient.
- **Крупнейшие компоненты и границы распила** (строки — текущие):
  - `Player.tsx` (1023): PlayerSidebar (55-195, уже `React.memo`), FloatingControls (197-303, уже в том же файле — вынести), voice/SpeechRecognition (737-760), транскрибация (442-467), экспорт (762-779), comment CRUD (509-535), версии/compare (781-786), рендер (802-1024). Естественные границы: `VoiceRecognition`, `CommentInputBar`, `ExportMenu`, `PlayerHeader`.
  - `ProjectView.tsx` (986): StorageIndicator (458-518), UploadZoneTile (388-455), share/participants/org-модалки (759-949) → отдельный `ShareModal.tsx`.
  - `Profile.tsx` (962): S3-пресеты/гайды (23-111) → `services/s3Presets.ts`; S3-форма (593-748) и WhiteLabel (754-829) → `StorageSettings.tsx`.
  - `App.tsx` (777): TOUR_STEPS (103-122) → константы; тур-логика (524-600) → хук; UploadWidget (48-93) → компонент.
  - `Dashboard.tsx` (774): share-модал (672-771) дублирует ProjectView — объединить.
  - admin-табы: AdminPaymentsTab (571), AdminFeaturesTab (516), AdminContentTab (474), AdminUsersTab (349), AdminStrategyTab (122) — самодостаточны, распил не требуется.
- Факт: `tsc --noEmit` — 4 ошибки (повторный прогон): App.tsx:638,110 и 684,106 (`Cannot find name 'setIsAuthModalOpen'`), Dashboard.tsx:133,7 (`string|null` vs `string|undefined`), transcriptionWorker.ts:18,38 (`string` vs `PipelineType` — `static model = 'Xenova/whisper-tiny'` расширяется до `string`, см. transcriptionWorker.ts:8-12). `npm run build` — vite build без tsc (package.json scripts).
- dist (измерено): `index-*.js` 842 263 байт, `transcriptionWorker-*.js` 876 806 байт, `ort-wasm-simd-threaded-*.wasm` 21 596 019 байт (21,6 МБ) — тяжёлый WASM грузится лениво через `new Worker` (Player.tsx:449), но бандл воркера 877 КБ попадает в префетч по умолчанию.

### F. System Diagnostics (services/testSuite.ts + components/TestRunner.tsx)

13 групп, 16 тестов:

| Группа | Тесты | Что реально проверяется | Ложный успех? |
|---|---|---|---|
| api | API Healthcheck | fetch `/api/health` — реально | в mock/preview-режиме падает, не зеленит |
| api | Auth Guard (401) | fetch `/api/data` без токена — реально | — |
| billing_integration | Payment Init | только «401 без токена» — проверяет лишь наличие auth-чека | не проверяет оплату/вебхуки |
| billing_integration | Webhook Endpoint | ожидает 400 на пустой body; **сервер отвечает 200** (payment.js:70-74 игнорит событие) | тест падает, вскрывая отсутствие валидации; оракул не соответствует реализации |
| auth | Org Admin Detection | `isOrgAdmin` на моках — реальная проверка утилиты | — |
| media | Video CDN Access | HEAD на чужой gtv-videos-bucket — проверяет сторонний CDN и сеть клиента, не приложение | частично: зеленит/падает независимо от кода |
| player | Deterministic Color Hash | `stringToColor` — реально | — |
| storage | Upload Security Guard | **имитация** `allowedTypes.includes('application/exe')` внутри теста | **да**: реальный allowlist (upload.js:59) не участвует — тавтология |
| math | FPS Calculation (PAL) | арифметика `Math.floor(1.5*25)===37` — тривиальная | не тестирует реальный расчёт кадров |
| math | SMPTE Timecode | `formatTimecode(65.5,25)` — реальная проверка утилиты | — |
| billing | Subscription Expiry / Days Remaining | `isExpired`/`getDaysRemaining` — реально | — |
| export | EDL Header | `generateEDL` — реально | — |
| export | XML Escaping | `generateResolveXML` — реально | — |
| security | XSS Sanitization | **sanitize делается внутри теста** (`unsafeInput.replace(...)`) | **да**: тавтология, реальная отрисовка не проверяется |
| sys | UUID Generation | `generateId().length>=32` — слабый (не проверяет уникальность/формат) | частично |
| perf | Large Array Filter (50k) | микробенчмарк фильтра массива — шумный, зависит от железа | да: может давать ложный fail/pass |
| i18n | URL Encoding (Cyrillic) | `encodeURIComponent` — проверяет браузер, не код приложения | **да**: тавтология |

Чего не хватает: SpeechRecognition availability + `mediaDevices.getUserMedia` permission; viewport/safe-area/UI-адаптивность; целостность i18n-ключей (сравнение локалей); upload-pipeline pure-функции (naming/версионирование/откат useUploadManager); экспорт-генераторы CSV/EDL edge (29.97fps, длинные комменты); presign/ACL (доступ к чужому проекту); comment-конфликт 409; подпись webhook; конкурентная запись JSON (CAS). TestRunner UI (TestRunner.tsx) — корректен, health-score «Total/Passed/Failed».

---

## 4. Верифицированные находки AutoCoder (проверено вручную до аудита) — включено дословно, статус «подтверждено»

Блок ниже проверен вручную до аудита; каждый пункт сверен с кодом повторно и помечен «подтверждено»:

- [подтверждено] P0 Player.tsx:737-755 startListening: recognition.lang жёстко 'en-US' (строка 746) — русская речь транскрибируется как английская; нет выбора языка.
- [подтверждено] P0 Player.tsx:737-755: нет обработчика onerror у SpeechRecognition — отказ в доступе к микрофону/сбой сети = молчаливый провал (кнопка гаснет без сообщения); notify только при отсутствии API (739-741).
- [подтверждено] P1 Player.tsx:744-745: continuous=false, interimResults=false — только одна фраза за нажатие, длинные правки обрезаются.
- [подтверждено] P1 Player.tsx:487-488: VoiceModal открывается ТОЛЬКО хоткеями KeyO/KeyM (setShowVoiceModal(true) больше нигде не вызывается) — на тач-устройствах модалка недостижима.
- [подтверждено] P1 Player.tsx:293-295: кнопка Mic в FloatingControls видна только при isFullscreen И установленном маркере (IN/OUT).
- [подтверждено] P1 Player.tsx:861: переключатель вида single/compare обёрнут в hidden md:block — на телефоне функции сравнения версий нет.
- [подтверждено] P2 Player.tsx:811: window.innerWidth > 768 прямо в рендере без resize-состояния — устаревает при повороте устройства.
- [подтверждено] P2 Player.tsx:757 handleQuickMarker: читает markerInPoint до того, как setState применился (stale closure), и молча ничего не делает при пустом тексте.
- [подтверждено*] P2: recognitionRef/workerRef не останавливаются при unmount (эффект 534-537 сбрасывает только на смене версии). *Уточнение аудита: workerRef **останавливается** при unmount — `useEffect` Player.tsx:431-438 вызывает `workerRef.current.terminate()`. Подтверждено, что `recognitionRef` (активная сессия SpeechRecognition) при unmount НЕ останавливается — микрофон может остаться включённым после выхода из плеера.
- [подтверждено] P2 index.html:6: user-scalable=no, maximum-scale=1 — блокирует зум (доступность).
- [подтверждено] P1 api/_crypto.js:6: фолбэк мастер-ключа шифрования захардкожен в репозитории.
- [подтверждено] Факт: tsc --noEmit exit 2 (4 ошибки выше); npm run build exit 0; dist раздут: index 817KB, transcriptionWorker 877KB, ort-wasm 21.6MB. (Повторный прогон tsc: 4 ошибки, те же. dist: index 842 КБ, worker 877 КБ, ort-wasm 21,6 МБ — совпадает с допуском округления.)
- [подтверждено] Факт: services/transcriptionWorker.ts (Whisper) не используется как fallback для голосовых комментариев — только для транскрибации видео (Player.tsx:442-467).

---

## 5. Не проверено

- Динамическая проверка эксплойтов (webhook-подделка, IDOR, удаление чужих объектов) не выполнялась — только чтение кода; выводы о возможности — по статике.
- Фактическое состояние переменных окружения (CRON_SECRET, CLERK_SECRET_KEY, YOOKASSA_* в проде) — недоступно; пункты, зависящие от env, помечены candidate (R11, R03 частично).
- Схема БД Vercel Postgres (миграции, индексы, реальные `owner_id`/`org_id` данные) — не инспектировалась; поведение при 42P01 (data.js:410 возвращает `[]`) частично.
- Поведение Clerk-организаций в рантайме (org-роли, членства) — по коду, без live-проверки.
- Реальный UX на эмуляторах/устройствах (safe-area, z-index-наложения, hover-скрытие) — оценено статически по классам.
- Мок-режим (preview без Clerk) не запускался; часть выводов о mock-путях — по чтению (apiClient.ts:71-152).
- Vercel Blob/Drive/S3 фактическое поведение (лимиты, CORS, публичные ссылки) — не тестировалось.
- Бандл-анализ dist ограничен размерами файлов; детальный tree-shaking не проводился.
