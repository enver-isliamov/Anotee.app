# TASKS — Бэклог и playbook постановки задач

> Единый источник задач для агентов и разработчиков. Формат ID: `T-NN`. Приоритеты: **P0** (безопасность/блокер пользователей) → **P1** (критично для продукта) → **P2** (качество). Статусы: `todo` / `in-progress` / `done` / `wontfix`.

## Как ставить задачу (шаблон)

```markdown
### T-XX <Краткое название>
- Приоритет: P0|P1|P2
- Проблема: <что ломается, для кого, файл:строка>
- Цель: <как должно работать>
- Acceptance: <проверяемые критерии + какой тест покрывает>
- Железные правила: <какие пункты AGENTS.md §4 затрагиваются>
- Риски: <что может сломаться>
```

Правило: задача из System Diagnostics попадает сюда с префиксом источника `[diag]` и готовым текстом из отчёта `/test`.

---

## Активный бэклог

### T-01 P0 `todo` Подпись webhook'ов платежей
- Проблема: `api/payment.js:41-114, 237-263` — webhook ЮKassa обрабатывает `payment.succeeded` без проверки (нет сверки IP/повторного запроса платежа через API), Prodamus игнорирует HMAC-поле `sign`. Подделка POST с чужим `metadata.userId` выдаёт Pro навсегда.
- Цель: ЮKassa — после получения webhook повторно запросить платёж `GET /v3/payments/{id}` с basic-auth и принимать только при `status === 'succeeded'` и совпадении суммы/плана; Prodamus — проверять `sign` (md5 отсортированных параметров + secret) до `upgradeUser`.
- Acceptance: unit-тест на отклонение подделанного webhook; ручная проверка на staging с тестовыми ключами обоих провайдеров.
- Риски: не сломать реальный webhook (железное правило №1 — правки в том же файле `payment.js`).

### T-02 P0 `todo` Org-IDOR: список проектов организации
- Проблема: `api/data.js:361-368` — GET с `orgId` возвращает все проекты орг без проверки членства (в `check_updates` проверка есть — `data.js:117-118`).
- Цель: перед org-запросом — `getOrganizationMembershipList` и 403 при отсутствии членства.
- Acceptance: запрос с чужим orgId → 403; свой org → список. E2E/Diagnostics-проверка auth-матрицы.

### T-03 P0 `todo` Крипто: фолбэк мастер-ключа
- Проблема: `api/_crypto.js:6` — при отсутствии env используется захардкоженный `'default-fallback-secret-key-do-not-use-in-prod'`; AES-CBC без HMAC (malleability).
- Цель: падать с явной ошибкой при отсутствии `CLERK_SECRET_KEY` (не шифровать предсказуемым ключом); миграция на AES-256-GCM с сохранением чтения старых записей (re-encrypt on read).
- Acceptance: unit-тест encrypt/decrypt roundtrip; тест, что без env функция бросает.

### T-04 P1 `todo` Storage-IDOR: ключи S3 не ограничены проектом
- Проблема: `api/storage.js:226-282` — presign/delete принимают `key`/`prefix` от клиента без проверки принадлежности проекту; участник проекта A может удалить файлы проекта B и весь бакет.
- Цель: server-side валидация `key.startsWith('anotee/{projectId}/')` + checkProjectAccess для данного projectId.

### T-05 P1 `todo` Sync: обработка CAS-конфликта
- Проблема: `api/data.js:487-493` — после UPDATE не проверяется rowCount; клиент получает ложный `status:'updated'` при проигранной гонке → молчаливая потеря правок (комментарии, версии).
- Цель: при 0 обновлённых строк возвращать 409 + актуальный документ; клиент (`Player` syncCommentAction / `App` forceSync) — повторить применение поверх свежих данных.

### T-06 P1 `todo` Viewer может писать весь проект
- Проблема: `api/data.js:417-456, 459-509` — POST/PATCH не проверяют роль участника; viewer перезаписывает team/assets/name.
- Цель: матрица прав на сервере: owner/manager — полный PUT; member — комментарии/статусы; viewer/public guest — только comment-action.

### T-07 P1 `done` Микрофон-флоу: пакет исправлений `[diag]`
- Проблемы (все подтверждены аудитом):
  - `Player.tsx:746` — `recognition.lang='en-US'` жёстко: русская речь не транскрибируется;
  - `Player.tsx:737-755` — нет `onerror`: отказ в доступе к микрофону = молчаливый провал;
  - `Player.tsx:744-745` — `continuous=false, interimResults=false`: одна фраза, без live-текста;
  - `Player.tsx:487-488` — VoiceModal доступен только с клавиатуры (KeyO/KeyM); на телефоне модалки нет;
  - `Player.tsx:293-295` — Mic в FloatingControls только при fullscreen + выставленном маркере;
  - Whisper (`transcriptionWorker.ts`) не используется как fallback там, где SpeechRecognition отсутствует (Firefox).
- Цель: язык = язык интерфейса (i18n); onerror → понятный toast с причиной (not-allowed/service-not-allowed/network) и подсказкой; кнопка микрофона доступна на мобильных в поле комментария и в плеере; (опц.) fallback на MediaRecorder+Whisper.
- Acceptance: e2e `voice.spec.ts` зелёный; на iPhone Safari кнопка видна и даёт понятную ошибку при отказе в доступе.
- Итог (этот коммит): `recognition.lang` = язык интерфейса (маппинг `SPEECH_RECOGNITION_LANGS`: ru→ru-RU, en→en-US, es→es-ES, pt→pt-BR, ja→ja-JP, ko→ko-KR); добавлен `onerror` с i18n-тостами (`player.voice.err_denied` / `err_network` / `err_generic`, `no-speech` — тихо), `isListening` сбрасывается в onend+onerror; `interimResults=true` — interim подставляется в поле комментария поверх накопленных финалов, ручной ввод во время слушания отслеживается в `onChange` и не затирается (логика диктовки — в refs вне setState-updater, чтобы updater оставался чистым); Mic в FloatingControls видим всегда (без fullscreen/маркера) и открывает VoiceModal; VoiceModal рендерится и без fullscreen → доступен на мобильных; при unmount recognition останавливается (try/catch, onend-отключён); `handleQuickMarker` при пустом тексте даёт notify-подсказку (`player.voice.need_text`); «not supported» переведён (`player.voice.unsupported`). Новые ключи en/ru парами. e2e `voice.spec.ts` + mock (interim→final с `resultIndex`) зелёные; вручную на iPhone не проверялось (нет устройства) — механика отказа покрыта кодом onerror.

### T-08 P1 `done` Мобильная доступность UI: пакет исправлений
- Проблемы: hover-only кнопки карточек (`Dashboard.tsx:443-474`, `ProjectView.tsx:679-715, 920`); переключатель вида single/compare скрыт на мобиле (`Player.tsx:861`); `window.innerWidth` в рендере без resize-state (`Player.tsx:811`); `user-scalable=no` (`index.html:6`).
- Цель: на `<md` все действия видимы и кликабельны (иконки всегда видны или меню «⋯»); сравнение версий доступно на мобильных; innerWidth через хук с resize-листенером; убрать блокировку зума (a11y).
- Acceptance: e2e mobile-viewport спеки зелёные; ручная проверка 390×844.
- Примечание (тест-инфраструктура): регрессии уже зафиксированы как `test.fixme('T-08: …')` в `tests/e2e/mobile.spec.ts` (проект Playwright «mobile», Pixel 7 412×915) — при фиксе перевести их в обычные тесты и снять пометки.
- Итог (этот коммит): кнопки карточек Dashboard и ассетов/участников ProjectView — паттерн `opacity-100 md:opacity-0 md:group-hover:opacity-100`, тач-таргеты `p-2.5 md:p-1.5` (микрофон и view-switcher в плеере — 40×40 на мобиле); view-switcher виден на мобиле (убран `hidden md:block`, меню по тапу работает); `window.innerWidth` в рендере Player заменён на `isDesktopViewport` (state + resize-листенер); viewport = `width=device-width, initial-scale=1, viewport-fit=cover`; 3 fixme из `mobile.spec.ts` разморожены и зелёные; попутно исправлен regex сепарации проектов в `playwright.config.ts` (`/mobile\.spec\.ts/` вместо нерабочего `/.*\.mobile\.spec\.ts/` — раньше mobile-спеки гонялись на десктопе, а проект «mobile» не запускался вовсе). Ручная проверка 390×844 не проводилась (агентская среда), e2e-проект «mobile» (Pixel 7 412×915) зелёный.

### T-09 P1 `done` TypeScript: tsc --noEmit зелёный
- Проблема: 4 ошибки: `App.tsx:638,684` — `setIsAuthModalOpen` не существует; `Dashboard.tsx:133` — `string|null` vs `string|undefined`; `transcriptionWorker.ts:18` — `string` vs `PipelineType`.
- Цель: устранить (удалить мёртвые вызовы / скорректировать тип), включить `tsc --noEmit` в CI.
- Итог (этот коммит): `App.tsx` — мёртвые вызовы несуществующего сеттера заменены на no-op `onLoginRequest={() => {}}` (прецедент в той же функции, строка с `Login onLogin={() => {}}`); `Dashboard.tsx` — `orgId: activeOrgId ?? undefined`; `transcriptionWorker.ts` — `static task: PipelineType`. `tsc --noEmit` включён в CI (`.github/workflows/ci.yml`).

### T-10 P2 `todo` i18n: добить языки
- Проблема: es/ja/ko/pt — 39/277 ключей; ~250 захардкоженных строк мимо `t()` (Player S3/Drive экраны, тосты). (`footer.rights` в ru и отсутствовавшие `common.edit`/`common.delete` в en/ru добавлены в этом коммите; контракт-тест `tests/unit/i18n.test.ts` не даёт деградировать.)
- Цель: автоперевод en→языки как база; вынести в t() строки пользовательских экранов Player; тест `i18n.test.ts` не даёт деградировать.

### T-14 P1 `done` Mock-режим: Clerk-хуки роняли приложение без ключа
- Проблема: в mock-ветке `App.tsx` нет `ClerkProvider`, но Clerk-хуки вызываются по всему дереву (`DriveProvider`, `useSubscription`, `useAppConfig`, `Dashboard`, `Player`, `Profile`) — Clerk v5 бросает «useAuth can only be used within the <ClerkProvider />», приложение падает в ErrorBoundary при старте без ключа. Кроме того, mock-пользователь (`mock-user`) не был владельцем/участником `MOCK_PROJECTS` (ownerId `u1`) — свежая mock-сессия всегда показывала пустой дашборд.
- Цель: mock-режим должен запускаться и показывать MOCK_PROJECTS без сети и Clerk JS (локальная разработка + e2e).
- Итог (этот коммит): `vite.config.ts` при отсутствии реального ключа алиасит `@clerk/clerk-react` на лёгкую заглушку `services/clerkShim.ts` (совместимая поверхность API, ноль сети); identity mock-пользователя совмещена с `u1` «Andrey (Creator)» — владельцем MOCK_PROJECTS. Реальный Clerk не затронут: с ключом алиас не применяется.

### T-11 P2 `todo` Бандл: снизить вес
- Проблема: index 817KB, transcriptionWorker 877KB, ort-wasm 21.6MB в dist (копится всегда).
- Цель: `manualChunks` (vendor/react/ai), динамический import AI-транскрипции по клику, воркер+wasm через CDN unpkg/jsdelivr (уже поддерживается transformers.js `env.backends.onnx.wasm.wasmPaths`).
- Acceptance: `npm run build` — main < 400KB gzip; ort-wasm не в dist.

### T-12 P1 `done` System Diagnostics 2.0 `[diag]`
- Проблема: текущий `/test` проверяет только API/billing поверхностно; при падении не отвечает на «что сломалось и что делать».
- Цель: окружение-панель (версия, mock, auth, браузер, viewport, сеть), группы тестов с серьёзностью, diagnosis+task при падении, мобильные и микрофонные проверки, экспорт отчёта в Markdown.
- Acceptance: каждый упавший тест даёт готовый текст задачи; прогон на мобильном viewport читабелен.

### T-13 P2 `todo` Двойная запись комментария `[diag][candidate]`
- Проблема: комментарий пишется и через полный sync проекта, и через comment-endpoint (`Player.tsx:509-525` + `data.js:165`) — возможны дубликаты при гонке.
- Цель: расследовать; оставить один канал записи, второй — только optimistic UI.

### T-15 P1 `done` Локальная сборка Tailwind: убрать cdn.tailwindcss.com (RF-устойчивость)
- Проблема: прод-`index.html` грузил Tailwind JIT с `cdn.tailwindcss.com` (inline-конфиг: darkMode class, zinc-950, animation/keyframes gradient-x) и importmap с `esm.sh` — оба хоста заблокированы/нестабильны в РФ, приложение не стартует (см. docs/RF-RESILIENCE.md).
- Цель: Tailwind собирается Vite-пайплайном; в `dist/index.html` нет внешних CDN-хостов.
- Acceptance: `npm run build` генерирует CSS в `dist/assets/*.css` с покрытием классов из кода (`bg-zinc-950`, `animate-in`/`fade-in`/`slide-in-from-*` от плагина, keyframes `gradient-x`, `bg-gradient-to-*`); `npm run check:external` (новый скрипт `scripts/check-external.mjs`, шаг в CI после build) — 0.
- Итог (этот коммит): `tailwind.config.js` (ESM, content: index.html + корень/components/services/hooks `{ts,tsx}`; theme.extend перенесён 1:1; плагин `tailwindcss-animate@^1.0.7` — без него отваливаются animate-in/fade-in/zoom-in/slide-in-from-*), `postcss.config.js` (tailwindcss+autoprefixer), `index.css` (@tailwind base/components/utilities, в корне рядом с index.tsx — папку src/ не создаём, железное правило №6) с `import './index.css'` в `index.tsx`; из `index.html` удалены CDN-скрипт+inline-конфиг (72-101) и importmap esm.sh целиком (активных module-скриптов с голыми импортами не было — единственный module-скрипт `/index.tsx` бандлится Vite), из error-handler убрана мёртвая проверка `esm.sh` (иначе строка оставалась бы в dist и ловилась check:external).

### T-16 P1 `done` Whisper-модель: настраиваемое зеркало (механизм; заливка файлов модели — на владельце)
- Проблема: `services/transcriptionWorker.ts` грузит `Xenova/whisper-tiny` с HF Hub; бинарники ONNX идут через `cdn-lfs.huggingface.co` — из РФ соединения сбрасываются, AI-транскрибация не работает.
- Цель: источник модели настраивается без правки кода (инструкция — docs/RF-RESILIENCE.md §4).
- Acceptance: с заданным `VITE_WHISPER_MODEL_BASE_URL` воркер запрашивает файлы модели с зеркала; без него поведение прежнее; `env.allowLocalModels=false`, `useBrowserCache=true` не тронуты.
- Итог (этот коммит): воркер читает поле `modelBaseUrl` входящего сообщения; если задано и ≠ дефолта `https://huggingface.co/` — до создания pipeline выставляется `env.remoteHost` (фактическое API transformers.js 3.8.1; `env.remotePathTemplate` остаётся дефолтным `{model}/resolve/{revision}/` — зеркало обязано повторять структуру HF Hub); `TranscriptionPipeline` дополнительно инвалидирует кэш инстанса при смене хоста (аналогично смене модели). `Player.tsx handleTranscribe` передаёт `modelBaseUrl` из `import.meta.env.VITE_WHISPER_MODEL_BASE_URL` (пусто → поле не передаётся). `.env.example` — закомментированная переменная с инструкцией (RU). Контракт воркера для остальных полей не изменён (e2e voice.spec мокает SpeechRecognition, не воркер — ок). Статус `done` относится к механизму; файлы модели на зеркале заливает владелец (список — RF-RESILIENCE.md §4.1).

### T-17 P1 `done` Локализация внешних картинок/аватаров (RF-устойчивость) — 4 из 5 точек; 1 исключение
- Проблема: фронтенд тянул превью и аватары с `images.unsplash.com` и `api.dicebear.com` — недоступны/нестабильны из РФ (пустые превью/аватары у части пользователей).
- Цель: все декоративные изображения — из бандла или генерируются локально.
- Acceptance: в исходниках нет вызовов внешних сервисов картинок/аватаров (кроме задокументированного исключения); e2e зелёные.
- Итог (этот коммит): скачаны и заменены `LiveDemo.tsx` thumbnails → `public/img/demo-video-1.jpg`, `demo-video-2.jpg`; `ProjectView.tsx` onError-fallback → `public/img/thumbnail-fallback.jpg`; dicebear-аватары (`App.tsx:347` fallback, `LiveDemo.tsx` ×3, `ProjectView.tsx:321` initials) → новый `services/avatarUtils.ts` `generateInitialsAvatar(seed)` — data-URI SVG, инициалы + цвет из существующего `stringToColor`; mock-аватар (`App.tsx:772`, `services/clerkShim.ts:20`) → статичный `public/img/avatar-mock.svg`. **Исключение:** fallback в `services/utils.ts:80,110` (`photo-1574717024653-61fd2cf4d44c`) не заменён — фото удалено из CDN Unsplash (404 от источника, проверено через независимый прокси; соединение с unsplash в этот момент было рабочим на других фото). URL оставлен по инструкции задачи; ⚠ он мёртв и без РФ-блокировки — нужен выбор замены (например `thumbnail-fallback.jpg`) владельцем. Попутно замечено: `constants.ts` (MOCK_PROJECTS) содержит 5 unsplash-URL и `index.html` og:image — тот же мёртвый `photo-1574717024653-61fd2cf4d44c`; вне рамок T-17.

---

## Архив выполненных
| ID | Название | Коммит |
|---|---|---|
| T-09 (tsc --noEmit зелёный) | см. статус выше | этот коммит |
| T-14 (mock-режим без Clerk-краша) | см. статус выше | этот коммит |
| T-12 (Diagnostics 2.0) | см. статус | — |
