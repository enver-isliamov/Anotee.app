
# ⚙️ Critical Project Settings

Сохраните эти настройки. Они критически важны для работы авторизации и интеграции с Google Drive.

## 1. Clerk Dashboard (Authentication)
*   **Mode**: Development (`pk_test_...`)
*   **Social Connections** -> **Google** (Шестеренка ⚙️):
    *   **Use custom credentials**: ✅ **ВКЛЮЧЕНО** (Обязательно для Dev режима)
    *   **Client ID**: ID из Google Cloud Console
    *   **Client Secret**: Secret из Google Cloud Console
    *   **Scopes**:
        *   `email`
        *   `profile`
        *   `https://www.googleapis.com/auth/drive.file` (Критично для загрузки файлов)

## 2. Google Cloud Console
*   **Project Status**: Production (Рекомендуется, чтобы токены жили дольше 7 дней) или Testing.
*   **APIs & Services** -> **Enabled APIs**:
    *   Google Drive API
*   **Credentials** -> **OAuth 2.0 Client IDs**:
    *   **Authorized JavaScript origins**: `http://localhost:5173`, `https://ващ-домен.vercel.app`
    *   **Authorized redirect URIs**: Ссылка из Clerk Dashboard (обычно `https://clerk.ващ-домен.com/v1/oauth/callback`)

## 3. Environment Variables (.env)
*   `VITE_CLERK_PUBLISHABLE_KEY`: Ваш ключ Clerk (`pk_test_...`)
*   `CLERK_SECRET_KEY`: Ваш секретный ключ Clerk (`sk_test_...`)
*   `BLOB_READ_WRITE_TOKEN`: Токен Vercel Blob (для резервного хранилища)
*   `POSTGRES_URL`: Строка подключения к Vercel Postgres

## 4. Особенности работы (Troubleshooting)
*   **Sync Error в профиле**: Означает, что токен Google устарел или отозван.
    *   *Решение*: Нажать "Repair Connection" или полностью выйти (Logout) и зайти снова.
*   **Черный экран видео**: Обычно из-за ограничений Google Drive на прямые ссылки.
    *   *Решение*: Файлы должны иметь доступ "Anyone with the link can view". Приложение делает это автоматически при загрузке.

## 5. Архитектурные Правила (Hard Constraints)
**⚠️ НЕ ИЗМЕНЯТЬ БЕЗ СОГЛАСОВАНИЯ ⚠️**

*   **Воспроизведение Видео (Google Drive)**:
    *   **Метод**: Всегда использовать `drive.google.com/uc?export=download&id=...`.
    *   **Запрещено**: Использовать `googleapis.com/drive/v3/files/...` с заголовком Authorization.
    *   **Причина**: Браузерный тег `<video>` требует поддержки `Range Requests` (HTTP 206) для перемотки и потоковой загрузки. API Google Drive блокирует эти запросы через CORS при передаче токена в заголовке. Метод `uc` работает стабильно для публичных файлов.

## 6. Архитектура Плеера (Video Player Core)
**⚠️ ЛОГИКА ТАЙМКОДА И СКРАББИНГА ⚠️**

При рефакторинге компонента `Player.tsx` соблюдать следующие правила:

*   **Расчет Таймкода (Timecode Calculation)**:
    *   **Метод**: Всегда считать через **общее количество кадров** (Total Frames).
    *   **Формула**: `const totalFrames = Math.floor(seconds * fps);`
    *   **Кадры**: `const ff = totalFrames % fps;`
    *   **ЗАПРЕЩЕНО**: Использовать остаток от деления секунды `Math.floor((seconds % 1) * fps)`.
    *   **Причина**: Ошибки плавающей запятой (floating point errors) приводят к тому, что 24-й кадр может отобразиться как 23-й или перескочить, вызывая рассинхрон с EDL/XML экспортом.

*   **Логика Скраббинга (Scrubbing)**:
    *   **Таймлайн (Timeline Bar)**: Использует **Абсолютное** позиционирование. Клик/Драг устанавливает время пропорционально ширине (`percentage * duration`).
    *   **Область Видео (Video Overlay)**: Использует **Относительное** позиционирование (Precision Scrubbing).
        *   При `PointerDown` запомнить `startX` и `startTime`.
        *   При `PointerMove` вычислять `deltaX`.
        *   **Чувствительность**: `5 пикселей = 1 кадр`. Это позволяет покадрово листать видео, медленно двигая мышью/пальцем.
    *   **Разделение событий**: Обработчики событий для Таймлайна и Видео должны быть раздельными.

## 7. Versioning & Naming (Правила именования версий)
*   При загрузке новой версии к существующему ассету (`useUploadManager.ts`):
    *   **ЗАПРЕЩЕНО** использовать имя загружаемого файла (например, `Cut_Final_v2.mp4`).
    *   **ОБЯЗАТЕЛЬНО** использовать название родительского Ассета + индекс версии.
    *   **Формат**: `{AssetTitle}_v{NextNumber}.{extension}`.
    *   **Пример**: Ассет `Reels-Hudenie` -> Файл `Reels-Hudenie_v2.mp4`.

## 8. Player UX Defaults (Поведение Плеера)
*   **Инициализация**:
    *   При открытии плеера **ВСЕГДА** загружать последнюю версию из списка (`versions.length - 1`), игнорируя сохраненный `currentVersionIndex` (если он устарел).
*   **Выпадающий список (Dropdown)**:
    *   Список версий должен иметь `z-index: 100` или выше.
    *   Родительский контейнер заголовка в `Player.tsx` не должен иметь `overflow: hidden`, чтобы список мог выпадать поверх видео.
