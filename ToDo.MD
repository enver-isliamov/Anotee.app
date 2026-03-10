
# 🚜 Anotee Refactoring Roadmap

## 📋 План Действий

## 🚀 Этап XVII: Architecture Hardening (JWT & Caching)
**Статус:** ✅ **Этап завершен.**

## 💳 Этап XVIII: Billing & Admin Infrastructure
**Статус:** ✅ **Этап завершен (ЮKassa + Prodamus Integrated).**

## 💎 Этап XIX: Final Stabilization & Release Polish
**Статус:** ✅ **Этап завершен.**

## 🧪 Этап XX: Automated Testing & QA Infrastructure
**Статус:** ✅ **Этап завершен.**
*   Реализован `TestRunner.tsx`.
*   Покрыты тестами: API, Auth, Media, Math, Storage, Billing.
*   Доступен маршрут `/test`.

## ⚙️ Этап XXI: Dynamic Configuration & Versioning
**Статус:** ✅ **Этап завершен.**
*   Реализован `useAppVersion` хук.
*   Динамическое обновление версии приложения из Админки.
*   Хранение Feature Flags и Payment Config в PostgreSQL (`system_settings`).

## 🇷🇺 Этап XXII: Адаптация для работы в РФ (RF Resilience)
**Статус:** ✅ **Этап завершен (Cloudflare Configured)**

## 📦 Этап XXIII: BYOS (Bring Your Own Storage) & S3
**Статус:** ✅ **Этап завершен (Yandex/Selectel/R2 Supported).**

## 👥 Этап XXIV: S3 для Команд (Team Access Stabilization)
**Статус:** ✅ **Этап завершен.**

## 🔐 Этап XXV: Разграничение Доступа (Asset Sandboxing)
**Статус:** ✅ **Этап завершен.**
*   Реализован `restrictedAssetId`.
*   Безопасный шеринг отдельных файлов без доступа ко всему проекту.

## 🛠 Этап XXVIII: Admin Panel Refactoring & Security (RBAC)
**Статус:** ✅ **Этап завершен.**
*   **Модульность:** Админка разделена на независимые табы (`AdminUsersTab`, `AdminFeaturesTab`, `AdminPaymentsTab`).
*   **Безопасность:** Полный отказ от хардкода email-адресов администраторов.
*   **RBAC:** Внедрена проверка ролей через `Clerk Public Metadata` (`role: 'superadmin' | 'admin'`).
*   **Payment Editor:** Визуальный редактор тарифов и шлюзов.

## 🚀 Этап XXX: Instant Start (Large File Core)
**Статус:** ✅ **Этап завершен.**
Архитектура для работы с файлами любого размера (50Гб+) без блокировки интерфейса и с мгновенным доступом.

### 1. Архитектура "Мгновенного доступа" (Optimistic UI)
*   **Local Blob Preview:** Обновление `useUploadManager.ts` для использования `URL.createObjectURL(file)` сразу после выбора файла.
*   **Zero Latency:** Видео появляется в интерфейсе мгновенно (0 секунд задержки). Доступно для просмотра и паузы, пока идет загрузка в облако.

### 2. Защита "Гигантских загрузок" (Resilience)
*   **Infinity Timeout:** Установка `xhr.timeout = 0` в `services/googleDrive.ts`. Предотвращает обрыв загрузки больших файлов (50GB+) браузером.
*   **Tab Close Protection:** Добавление слушателя `beforeunload` в `useUploadManager.ts` для предотвращения случайного закрытия вкладки во время загрузки.

### 3. Visual Feedback & UX
*   **Asset Binding:** Добавление поля `tempAssetId` в `types.ts` для связывания задачи загрузки с конкретной карточкой ассета.
*   **Non-blocking Overlay:** Обновление `ProjectView.tsx` — прогресс-бар отображается поверх конкретной карточки, а не блокирует весь экран.

### 4. Seamless Swap (Бесшовная подмена)
*   **State Reconciliation:** Логика замены временной `blob:` ссылки на реальный `googleDriveId` или `s3Key` по достижении 100% загрузки.
*   **Background Sync:** Обновление данных проекта в БД без визуального "моргания" для пользователя.

## ⚡️ Этап XXIX: Realtime & P2P Engine (Cloudflare Stack)
**Статус:** 📅 **Запланировано**

Этот этап превращает Anotee из асинхронного плеера в виртуальную студию реального времени.

### 1. Core Streaming & Transfer
*   **NLE Live Link (Go Live):** Стриминг экрана монтажера (Premiere/Resolve) клиенту.
    *   *Tech:* Cloudflare RealtimeKit (SFU) для WebRTC low-latency (<200ms).
*   **Anotee Drop (P2P):** Передача тяжелых файлов (RAW/ProRes) напрямую между браузерами.
    *   *Tech:* WebRTC Data Channels + Cloudflare TURN Service (обход NAT/Firewalls).

### 2. Synchronous Collaboration (Co-Watching)
*   **Sync Playback:** Мгновенная синхронизация Play/Pause/Seek для всех участников сессии.
*   **Live Presence:** Отображение курсоров участников поверх видео ("покажи мышкой, где поправить").
*   **Live Telestrator:** Рисование поверх видео в реальном времени (исчезающие линии).
    *   *Tech:* WebRTC Data Channels (синхронизация координат и состояний).

### 3. Audio & Studio Tools
*   **Voice Over IP:** Голосовой чат внутри сессии (замена Zoom/Telegram звонков).
*   **Remote ADR:** Удаленная запись озвучки (диктор говорит в браузере -> файл пишется в проект).
    *   *Tech:* High-quality Audio Stream via SFU.

### 4. Infrastructure & Integrations
*   **Render Status Stream:** Десктоп-агент транслирует прогресс рендера из DaVinci в веб-интерфейс.
*   **Secure Tunnel:** Доступ к локальным медиа-серверам студии без VPN (Cloudflare Tunnel).

## 🎨 Этап XXVI: Visual Collaboration (Canvas Annotations)
**Статус:** 📅 **Запланировано (Next Priority)**
*   Рисование поверх видео (стрелки, круги).
*   Синхронизация координат рисунка с таймкодом.
*   Сохранение аннотаций в JSON.

## 🤖 Этап XXVII: AI Agents & Automation
**Статус:** 📅 **Запланировано**
*   Auto-Summary чата (LLM Integration).
*   Генерация субтитров (Server-side Whisper).
