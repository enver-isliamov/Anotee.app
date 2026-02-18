подробный diff‑план “без боли” для миграции локализации на стандартный стек (бесплатно), с минимальным риском для продакшна.

Навыки не применял: задача про архитектурный migration plan, а доступные skills (skill-creator, skill-installer) про создание/установку skills и здесь не подходят.

Цель миграции
Перевести текущую локализацию с монолитного services/i18n.tsx на i18next + react-i18next + JSON namespaces, сохранив:

текущий UX выбора языка,

fallback поведение,

cloud sync через Clerk.

Текущая база уже хорошая: key-based t('...'), localStorage + browser fallback + cloud sync уже реализованы. 

Текущее состояние (на что опираемся)
Языки: en/ru/es/ja/ko/pt. 

Огромный встроенный словарь DICTIONARIES в TSX. 

Fallback цепочка: lang -> en -> key. 

Есть не локализованные хардкоды в UI (важно закрыть в миграции):

Player: “Access Restricted”, “Fix Permissions…” и т.д. 

ProjectView: уведомления “Invite feature is locked…” и т.п. 

Пошаговый diff‑план (без боли), по PR
PR-1 (Инфраструктура, без массового переписывания UI)
1) Установка бесплатного стандарта
Файлы:

package.json

Изменения:

добавить зависимости:

i18next

react-i18next

dev:

i18next-parser (для extraction/валидации ключей)

Риск: низкий, код UI пока не трогаем.

2) Создать новую структуру переводов JSON
Файлы (новые):

locales/en/common.json

locales/ru/common.json

locales/es/common.json

locales/ja/common.json

locales/ko/common.json

locales/pt/common.json

Изменения:

вынести из DICTIONARIES ключи в JSON (пока один namespace common, чтобы не раздувать PR).

ключи оставить те же, чтобы не ломать текущие t('...') вызовы.

Риск: низкий, при сохранении ключей поведение одинаковое.

3) Добавить новый i18n-инициализатор
Файлы (новые):

services/i18n.config.ts (или services/i18next.ts)

Изменения:

resources из JSON;

fallbackLng: 'en';

supportedLngs: ['en','ru','es','ja','ko','pt'];

lng брать из localStorage('anotee_lang') или browser language (как сейчас). 

4) Встроить i18next в текущий провайдер (адаптерный режим)
Файлы:

services/i18n.tsx

Изменения:

не удалять useLanguage API.

внутри LanguageProvider использовать i18next.changeLanguage(language).

t(key) проксировать в i18next.t(key).

сохранить localStorage и cloud sync логику как есть. 

Почему это “без боли”:

компоненты продолжают импортировать useLanguage() без изменений.

5) Быстрая проверка совместимости
все экраны рендерятся как раньше;

переключение языка работает;

fallback ключей работает.

PR-2 (Стабилизация качества переводов, минимальный UI-touch)
6) Убрать очевидные хардкоды в критичных местах
Файлы:

components/Player.tsx

components/ProjectView.tsx

Изменения:

заменить хардкод строки на t('...') ключи:

Player: “Access Restricted”, “You need public access...”, “Fix Permissions...” и т.д. 

ProjectView: “Invite feature is locked…”, “Public Links are locked…” и т.д. 

Риск: низкий, локальные текстовые замены.

7) Добавить автоматическую проверку ключей
Файлы:

package.json

(опц.) .i18next-parser.config.cjs

Изменения:

scripts:

i18n:extract (парсит t('...') из компонентов)

i18n:check (сравнивает missing keys)

запуск в CI (или pre-merge check).

8) Документация для команды
Файлы (новый):

docs/i18n.md

Что прописать:

как добавлять ключи;

нейминг (player.*, dash.*, profile.*);

запрет новых хардкодов;

как проверять missing translations локально.

PR-3 (опционально, когда будет время) — разбивка на namespaces
9) Разделить common.json на доменные namespace
Файлы:

locales/*/{common,dashboard,player,project,profile,admin}.json

выборочные компоненты (меняем useTranslation('player') и т.д.)

Зачем:

ускоряет работу переводчиков и ревью;

уменьшает конфликты в PR.

Acceptance criteria (чтобы считать миграцию успешной)
Переключение языка и сохранение в localStorage работают как раньше. 

Cloud sync языка с Clerk не сломан. 

Fallback на en сохранён. 

Нет новых хардкод-строк в измененных компонентах.

Есть автоматическая проверка missing keys.

Почему это лучше и бесплатно
i18next/react-i18next/i18next-parser — open-source, бесплатные, индустриальный стандарт.

Миграция по адаптерной схеме не ломает текущие компоненты (рефактор можно делать постепенно).