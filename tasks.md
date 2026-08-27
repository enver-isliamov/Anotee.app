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

### T-07 P1 `todo` Микрофон-флоу: пакет исправлений `[diag]`
- Проблемы (все подтверждены аудитом):
  - `Player.tsx:746` — `recognition.lang='en-US'` жёстко: русская речь не транскрибируется;
  - `Player.tsx:737-755` — нет `onerror`: отказ в доступе к микрофону = молчаливый провал;
  - `Player.tsx:744-745` — `continuous=false, interimResults=false`: одна фраза, без live-текста;
  - `Player.tsx:487-488` — VoiceModal доступен только с клавиатуры (KeyO/KeyM); на телефоне модалки нет;
  - `Player.tsx:293-295` — Mic в FloatingControls только при fullscreen + выставленном маркере;
  - Whisper (`transcriptionWorker.ts`) не используется как fallback там, где SpeechRecognition отсутствует (Firefox).
- Цель: язык = язык интерфейса (i18n); onerror → понятный toast с причиной (not-allowed/service-not-allowed/network) и подсказкой; кнопка микрофона доступна на мобильных в поле комментария и в плеере; (опц.) fallback на MediaRecorder+Whisper.
- Acceptance: e2e `voice.spec.ts` зелёный; на iPhone Safari кнопка видна и даёт понятную ошибку при отказе в доступе.

### T-08 P1 `todo` Мобильная доступность UI: пакет исправлений
- Проблемы: hover-only кнопки карточек (`Dashboard.tsx:443-474`, `ProjectView.tsx:679-715, 920`); переключатель вида single/compare скрыт на мобиле (`Player.tsx:861`); `window.innerWidth` в рендере без resize-state (`Player.tsx:811`); `user-scalable=no` (`index.html:6`).
- Цель: на `<md` все действия видимы и кликабельны (иконки всегда видны или меню «⋯»); сравнение версий доступно на мобильных; innerWidth через хук с resize-листенером; убрать блокировку зума (a11y).
- Acceptance: e2e mobile-viewport спеки зелёные; ручная проверка 390×844.

### T-09 P1 `in-progress` TypeScript: tsc --noEmit зелёный
- Проблема: 4 ошибки: `App.tsx:638,684` — `setIsAuthModalOpen` не существует; `Dashboard.tsx:133` — `string|null` vs `string|undefined`; `transcriptionWorker.ts:18` — `string` vs `PipelineType`.
- Цель: устранить (удалить мёртвые вызовы / скорректировать тип), включить `tsc --noEmit` в CI.

### T-10 P2 `todo` i18n: добить языки
- Проблема: es/ja/ko/pt — 39/277 ключей; в ru отсутствует `footer.rights`; ~250 захардкоженных строк мимо `t()` (Player S3/Drive экраны, тосты).
- Цель: автоперевод en→языки как база; вынести в t() строки пользовательских экранов Player; тест `i18n.test.ts` не даёт деградировать.

### T-11 P2 `todo` Бандл: снизить вес
- Проблема: index 817KB, transcriptionWorker 877KB, ort-wasm 21.6MB в dist (копится всегда).
- Цель: `manualChunks` (vendor/react/ai), динамический import AI-транскрипции по клику, воркер+wasm через CDN unpkg/jsdelivr (уже поддерживается transformers.js `env.backends.onnx.wasm.wasmPaths`).
- Acceptance: `npm run build` — main < 400KB gzip; ort-wasm не в dist.

### T-12 P1 `in-progress` System Diagnostics 2.0 `[diag]`
- Проблема: текущий `/test` проверяет только API/billing поверхностно; при падении не отвечает на «что сломалось и что делать».
- Цель: окружение-панель (версия, mock, auth, браузер, viewport, сеть), группы тестов с серьёзностью, diagnosis+task при падении, мобильные и микрофонные проверки, экспорт отчёта в Markdown.
- Acceptance: каждый упавший тест даёт готовый текст задачи; прогон на мобильном viewport читабелен.

### T-13 P2 `todo` Двойная запись комментария `[diag][candidate]`
- Проблема: комментарий пишется и через полный sync проекта, и через comment-endpoint (`Player.tsx:509-525` + `data.js:165`) — возможны дубликаты при гонке.
- Цель: расследовать; оставить один канал записи, второй — только optimistic UI.

---

## Архив выполненных
| ID | Название | Коммит |
|---|---|---|
| T-09 (tsc) | см. статус | — |
| T-12 (Diagnostics 2.0) | см. статус | — |
