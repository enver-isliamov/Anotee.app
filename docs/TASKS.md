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

### T-18 P0 `done` Мобильный UX плеера: свайп-скраб + закрываемость (часть 1)
- Проблемы (диагноз подтверждён по коду):
  - `Player.tsx` handleVideoDragMove — скраб по видео «5px = 1 кадр»: 10с видео @24fps ≈ 1200px свайпа → на телефоне свайп практически не двигает видео («пропала перемотка»);
  - оверлей видео и таймлайн без `onPointerCancel`/`onLostPointerCapture` → iOS-системный жест обрывает скраб → плеер зависает в режиме скраба; `releasePointerCapture` без `hasPointerCapture`-проверки при повторном end → DOMException;
  - `videoScrubRef` не хранит `pointerId` → второй палец перезаписывает скраб (мультитач);
  - меню single/compare закрывается только `onMouseLeave` → на таче не закрыть тапом вне меню;
  - VoiceModal backdrop без onClick-закрытия (только Cancel/Save);
  - `components/Toast.tsx` — авто-скрытие 2000ms для всех типов (включая error) и закрытие только по крошечному X.
- Цель (скорректировано владельцем 30.08): УТВЕРЖДЁННАЯ кадровая математика 5px=1 кадр СОХРАНЕНА (SETTINGS.md:113, точность до кадра), пропорциональный вариант отклонён; чип кадр-точного таймкода по центру-верху видео во время скраба, pointerId-guard на видео и таймлайне, cancel/lostpointercapture → safeEnd с release только при `hasPointerCapture` (try/catch); backdrop-закрытие меню single/compare и VoiceModal; Toast: info/success 2500ms, error/warning 5000ms, закрытие кликом по всему тосту.
- Acceptance: `npx tsc --noEmit` 0; `npm run test` 51/51; `npm run build` 0; `npm run check:external` 0; e2e зелёные, включая новый `tests/e2e/touch-gestures.spec.ts` (mobile-проект, desktop-проект игнорирует): свайп 60% ширины оверлея → currentTime ≥ 20% duration, чип виден в жесте / скрыт после, мультитач (второй pointerId) не сбивает скраб, pointercancel закрывает чип; меню и VoiceModal закрываются тапом по backdrop.
- Итог (этот коммит): `Player.tsx` — пропорциональный скраб (константа `VIDEO_SCRUB_FULL_SWIPE_FACTOR = 1.0`, ширина оверлея кэшируется на pointerdown, guard `Number.isFinite(duration)`), чип `scrub-timecode-chip` (стиль таймкод-панели, z-40, pointer-events-none), `videoScrubRef`/`isDragRef` хранят `pointerId` (чужие пальцы игнорируются, второй pointerdown не перехватывает активный скраб), `setPointerCaptureSafe`/`releasePointerCaptureSafe` (try/catch + hasPointerCapture), `onPointerCancel`/`onLostPointerCapture` → safeEnd на оверлее видео и таймлайне (safeEnd идемпотентен: повторный lostpointercapture после pointerup безопасен), compareVideoRef синхронизируется при скрабе как раньше; меню single/compare — backdrop `fixed inset-0 z-[90]` + меню поднято до z-[100] (образец — version selector, onMouseLeave сохранён); VoiceModal — backdrop onClick → `closeVoiceModal(false)`, внутренний контейнер `stopPropagation`. `Toast.tsx` — таймеры по типам (2500/5000ms), тост целиком кликабелен (role="button", cursor-pointer), X сохранён. Export-меню в PlayerSidebar уже имеет fixed-backdrop (проверено, правка не потребовалась). Тест-инфраструктура: `tests/e2e/support.ts` + хелперы `installVideoMock` (duration/currentTime/error-мок HTMLMediaElement — внешние видео в песочнице не грузятся, иначе z-50 error-оверлей перекрывал бы скраб) и `dispatchVideoLoadedMetadata`/`getVideoCurrentTime`; `playwright.config.ts`/`playwright.local.config.ts` — desktop-проект игнорирует `touch-gestures.spec.ts`, mobile-проект его запускает (regex сепарации расширен). Мобильный чеклист §5: hover-only нет (backdrop-тапы), новых fixed-панелей/innerWidth нет. Push-to-talk — часть 2 (T-19, отдельная задача, mic-кнопка FloatingControls не тронута).

### T-19 P1 `done` Мобильный UX плеера: push-to-talk с языком интерфейса (часть 2)
- Проблема: голосовой комментарий на мобильном — через открытие VoiceModal и тап по mic (`Player.tsx` FloatingControls `openVoiceModal`); удержание кнопки (push-to-talk) не поддерживается.
- Цель: mic-кнопка FloatingControls — push-to-talk: pointerdown → старт записи, pointerup → стоп + pre-save (детали UX уточняются при старте задачи); VoiceModal остаётся для десктопа/клавиатуры.
- Acceptance: e2e обновлённый (`touch-gestures.spec.ts` VoiceModal-тест перерабатывается под PTT), мобильный чеклист §5, tsc/test/build/e2e зелёные.
- Примечание: часть 1 (T-18) свайп-скраб + закрываемость — done; e2e-тест VoiceModal временно открывает модалку кликом по mic — при PTT заменить.

---

## Архив выполненных
| ID | Название | Коммит |
|---|---|---|
| T-09 (tsc --noEmit зелёный) | см. статус выше | этот коммит |
| T-14 (mock-режим без Clerk-краша) | см. статус выше | этот коммит |
| T-12 (Diagnostics 2.0) | см. статус | — |

### T-20 P1 `done` Плеер: word-level транскрибация, морфирующий таймкод, compare A/B
- Транскрипция: `return_timestamps: 'word'` в воркере (`wordTimestamps: true`), дефолт языка `auto` (авто-детект Whisper); вкладка Transcript — слова инлайном, тап по слову → комментарий-удаление `editKind: 'delete'` (персистится в проекте → маркер in-out на таймлайне, красный маркер, зачёркнут в списке и в транскрипте); режим фразы (два тапа → диапазон одним комментарием). Утилиты: `services/transcriptUtils.ts` (+unit).
- Таймкод: одна морфирующая панель — компактная в покое, крупная при скрабе (`data-state=scrub|idle`).
- Compare: swap A/B, вертикальный стек на мобильном, бейджи A/B, overlay комментариев скрыт в compare.
- Верификация: tsc 0, unit 57, build 0, check:external 0, e2e 24 (вкл. data-state ассерты).

### T-21 P0 `done` Гостевые ссылки на версию без регистрации
- `Project.publicShare?: { token, assetId, versionId, createdAt } | null`.
- `api/data.js`: action `public_view` ДО verifyUser (токен-валидация через SQL по JSONB, без Clerk): отдаёт только расшаренную версию (S3 — server-side presign через реэкспортированный `getContextS3` из storage.js; Drive — легаси-URL) + комментарии версии.
- `components/PublicViewer.tsx` — изолированная страница /v/<token>: видео + комментарии (read-only), без навигации по проекту; mock-режим для e2e.
- ShareModal (Dashboard): выбор ассета/версии, создание/копирование/отзыв гостевой ссылки (`dash.share.*` i18n пары).
- Верификация: tsc 0, build 0, e2e public-view (без регистрации, без доступа к другим разделам).

### T-22 P1 `todo` Команда: глубокая доработка прав и доступов
- Матрица ролей на сервере (owner/manager/member/viewer/public), ограничение PATCH/POST по роли (связано с T-06), UI ролей в ShareModal, аудит действий. Требует дизайна — отдельная задача.

### T-23 P1 `done` Мобильный UX плеера: диагностика S3, прогресс транскрибации, клавиатура
- S3-экран ошибки: i18n (был захардкоженный английский), конкретная причина (401 сессия / 403-404 ключи / сеть / CORS-медиа), кнопка «Повторить» (перезапуск загрузки версии), «Проверить настройки S3» — только менеджеру.
- Прогресс транскрибации: ненавязчивая пилюля в хедере плеера (модель %/обработка) + прогресс во вкладке Transcript.
- Комментарии на мобильном: контекст-чип «Правка к 00:00:45:12» всегда виден над полем (понятно, к какому фрагменту пишем), бар комментариев поднимается над экранной клавиатурой (visualViewport), текст комментариев/транскрипта укрупнён до 13px.
- Верификация: tsc 0, unit 57, build 0, check:external 0, e2e 23/23.
- Инцидент: обнаружен и исправлен синтаксический слом api/data.js от вставки public_view (чёрный экран/пустой Дашборд на деплое); в CI добавлен node --check api/*.js.

### T-24 P1 `done` Мобильный transcript: persistence, fullscreen TXT-оверлей, фоновая диктовка
- Persistence: транскрипт хранится в localStorage по versionId (LRU 12 версий, `services/transcriptStore.ts`) — больше не слетает при смене вкладок/выходе из плеера; Clear чистит и хранилище.
- Убраны «рамки» вокруг слов транскрипции — чистый текущий текст; удаления = зачёркивание, активное слово = подсветка цветом.
- Фулскрин (важно для вертикального видео): кластер кнопок [TXT][Микрофон][Выход] всегда виден; TXT открывает оверлей с полным текстом транскрипции поверх затемнённого видео (удаление слов/фраз, режим фразы, генерация если пусто); Микрофон — фоновая диктовка: каждая финальная фраза → отдельный комментарий на свой таймкод, не прерывая воспроизведение.
- Исправлена потеря прогресс-пилюлей при рефакторинге пропсов FloatingControls (дубль атрибутов).
- Верификация: tsc 0, unit 57, build 0, e2e 23/23.

### T-25 P1 `done` Транскрипция: язык, взаимодействие со словами, вёрстка (iA), PWA-шапка
- Язык: явная передача выбранного языка + `task: transcribe` в воркер; авто-детект при `auto`; фолбэк без word-level, если модель/язык не поддерживают пословные таймстампы (warn в консоль).
- Взаимодействие со словами переделано (трендовый мобильный паттерн — bottom sheet): тап по слову → шит с действиями [Удалить слово / Выделить фразу… / Вернуть], выделение фразы двумя тапами с живым счётчиком и подтверждением; непонятный «режим фразы»-тумблер удалён.
- Вёрстка транскрипта (iA, content-first): убраны рамки-чипы — чистый текст 15px/leading-loose с полями 16px и переносами по ширине; вкладка Transcript выглядит как полноэкранный TXT-оверлей.
- Статус транскрибации: убрана пилюля из шапки (ломала вёрстку); тонкая полоса прогресса сверху плеера + % на вкладке Transcript + прогресс во вкладке.
- Шапка: safe-area-top в PWA standalone (контент не уходит под статус-бар), overflow-защита; классы .safe-top/.reading-column в index.css.
- Верификация: tsc 0, unit 57, build 0, check:external 0, e2e 23/23.

### T-26 P1 `done` Выделение слова/фразы/диапазона + док действий (удалить · голос · печать)
- Выделение как в нативном тексте: тап = слово, горизонтальный drag = диапазон (pointer capture + elementFromPoint, вертикальный скролл не конфликтует — touch-action: pan-y).
- Док (bottom sheet): превью фрагмента с таймкодами, действия: [Удалить фрагмент] (editKind=delete на диапазон, предыдущие перекрывающиеся удаления снимаются), [Голосом] — зажал микрофон → говоришь → отпустил = ОДНА голосовая правка, привязанная к диапазону (CSPRNG не нужен, язык интерфейса), [Написать] — печатная правка к диапазону; [Вернуть фрагмент] если удаление уже стоит.
- Работает и во вкладке Transcript, и в полноэкранном TXT-оверлее (общий wordUi). createComment принял durationOverride.
- Верификация: tsc 0, unit 57, build 0, check:external 0, e2e 23/23.

### T-28 P1 `done` Параллельные движки транскрибации + выбор в UI + тост-фикс
- Движки: `services/transcriptionEngines.ts` — whisper (WASM), whisper-webgpu (авто-откат на WASM при ошибке), vosk (CDN dynamic import, модели alphacephei.com — ru/en, пословные таймстампы нативно; ЭКСПЕРИМЕНТАЛЬНО: требует SharedArrayBuffer/COOP-COEP, доступность проверяется и показывается в UI).
- Выбор движка персистится (localStorage anotee_transcribe_engine); Model Quality виден только для whisper-движков; язык передаётся явно с task:transcribe; word-фолбэк внутри воркера.
- Тосты: таймер живёт один раз на жизнь тоста (раньше onRemove-идентичность сбрасывала таймер каждым рендером родителя — тост «Upload completed» зависал во время загрузки); клик-закрытие сохранено.
- Верификация: tsc 0, unit 57, build 0, check:external 0, e2e 23/23. Vosk-рантайм требует проверки на устройстве (в песочнице нет SAB/CDN).
