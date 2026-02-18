Ниже — полная версия Diff‑плана, уже с учетом причин текущей поломки (когда вместо текста отображаются ключи вроде page.workflow.title).

Почему сломалось (корневая причина)
StaticPages и другие компоненты рендерят ключи через t('...') (например page.workflow.title, page.docs.title). 

В новом адаптере t стал прямым вызовом i18n.t(key) без “legacy fallback” на старый словарь. Если ключа нет в JSON, в UI уходит сам key. 

Миграция словарей сделана неполной: часть языков сильно урезана (например es.json очень короткий), поэтому ключи не резолвятся. 

Полный “безболезненный” Diff‑план (как делать заново)
PR‑0 (подготовка и safety net, обязательно)
Файлы
services/i18n.tsx

services/i18n.legacy.ts (новый)

scripts/i18n/ (новые скрипты)

Изменения
Вынести текущий “старый” словарь в services/i18n.legacy.ts как LEGACY_DICTIONARIES (en/ru/...).

Сделать функцию legacyT(lang, key), которая дает старое поведение fallback (lang -> en -> key).

В useLanguage().t временно включить двойной fallback:

сначала i18next.t(key),

если вернулся key/пусто — брать legacyT(language, key).

Добавить runtime warning в dev: если сработал legacy fallback, логировать missing key.

Зачем
Даже при неполных JSON интерфейс не ломается и показывает прежний текст.

PR‑1 (инфраструктура i18next, но без риска для UI)
Файлы
package.json

services/i18n.config.ts

services/i18n.tsx

App.tsx (если нужно только проверить подключение)

Изменения
Подключить i18next + react-i18next. 

Инициализировать i18n.config.ts с:

fallbackLng: 'en',

supportedLngs,

lng из localStorage/browser (как сейчас). 

В LanguageProvider оставить текущий API (language, setLanguage, t) — чтобы не трогать все компоненты. 

Сохранить cloud sync с Clerk без изменений. 

PR‑2 (контент: полный перенос ключей, без “обрезаний”)
Файлы
services/locales/en.json

services/locales/ru.json

services/locales/es.json

services/locales/ja.json

services/locales/ko.json

services/locales/pt.json

Изменения
100% ключей из legacy словаря перенести в en.json и ru.json.

Для es/ja/ko/pt на первом этапе:

либо тоже полный перенос,

либо временно копия en.json (лучше чем raw keys).

Ввести правило: если ключ есть в коде, он обязан быть в en.json.

Критично
Нельзя мержить PR, если page.workflow.*/page.docs.* и др. не присутствуют (иначе снова увидишь ключи в UI). 

PR‑3 (контроль качества, чтобы больше не повторялось)
Файлы
package.json

.i18next-parser.config.(js|cjs) (новый)

scripts/i18n/* (новые)

Изменения 
Добавить скрипты:

i18n:extract (вытаскивает ключи из t('...'))

i18n:check (падает, если в en.json не хватает ключей)

CI gate:

PR не проходит без зеленого i18n:check.

Доп. check:

smoke-поиск “key-like strings” в собранном UI (например page./pv.).

PR‑4 (только после стабильности): удалить legacy fallback
Файлы
services/i18n.tsx

services/i18n.legacy.ts (удалить)

docs

Изменения
Убрать fallback на старый словарь из t().

Оставить только i18next JSON source.

Зафиксировать в документации “как добавлять ключи”.

Дополнительно (параллельно): убрать hardcoded строки
Файлы
components/Player.tsx

components/ProjectView.tsx

соответствующие locale JSON

Что исправить
Заменить хардкодные строки на t('...'), чтобы не было смешения языков:

"Upgrade Required", "Comments locked" в Player. 

уже начатые предупреждения в ProjectView продолжить в таком же стиле. 

Definition of Done (что считать “сделано правильно”)
На страницах, где раньше было page.workflow.title, отображается нормальный текст (не key).

en.json покрывает 100% используемых ключей.

CI блокирует PR при missing keys.

Язык сохраняется в localStorage и синхронизируется с Clerk как раньше.

Сообщить о готовности каждого этапа и отмечать выполненные пункты.