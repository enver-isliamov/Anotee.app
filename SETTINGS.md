
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

## 5. Железные Правила Воспроизведения (Video Playback Hard Rules)
**⚠️ КРИТИЧЕСКИ ВАЖНО. НЕ ИЗМЕНЯТЬ БЕЗ СОГЛАСОВАНИЯ ⚠️**

Для стабильного воспроизведения видео с Google Drive в HTML5 плеере (`<video>`) необходимо соблюдать три условия. Любое отклонение приведет к ошибке `403 Forbidden` или невозможности перемотки.

### 1. Формат Ссылки (URL Format)
*   **ОБЯЗАТЕЛЬНО**: Использовать "Legacy" формат экспорта:
    `https://drive.google.com/uc?export=download&confirm=t&id={FILE_ID}`
*   **ЗАПРЕЩЕНО**: Использовать `googleapis.com/drive/v3/files/...` с заголовком `Authorization`.
    *   *Причина*: Браузер отправляет `OPTIONS` запрос (preflight) перед загрузкой видео. Google API для эндпоинта `/files` часто блокирует заголовки `Range` (необходимые для перемотки) в CORS-ответах, если передается токен авторизации. Ссылки формата `uc?export=download` работают через стандартные Cookie/Public access и поддерживают Byte-Range запросы.

### 2. Атрибут CORS (Cross-Origin Attribute)
*   **ОБЯЗАТЕЛЬНО**: В компоненте `Player.tsx`, тег `<video>` **НЕ ДОЛЖЕН** иметь атрибут `crossOrigin="anonymous"`.
    ```tsx
    // ✅ Правильно
    <video src={driveUrl} ... />

    // ❌ Ошибка (Видео не загрузится с Drive)
    <video src={driveUrl} crossOrigin="anonymous" ... />
    ```
    *   *Причина*: Google Drive в режиме `uc?export=download` редко отдает корректные заголовки `Access-Control-Allow-Origin`, даже если файл публичный. Установка `crossOrigin="anonymous"` заставляет браузер строго требовать эти заголовки, что приводит к блокировке загрузки. Без этого атрибута видео загружается в режиме "opaque", что разрешает воспроизведение (хотя и запрещает чтение пикселей через Canvas, но для плеера это допустимо).

### 3. Авто-исправление Прав (Permissions Auto-Heal)
*   В `Player.tsx` реализована логика "самолечения":
    1.  При ошибке загрузки (`onError`) проверяется статус файла.
    2.  Если файл существует, но не грузится -> вызывается `GoogleDriveService.makeFilePublic(id)`.
    3.  После успешного исправления прав ссылка обновляется с параметром `&retry={timestamp}`.
    4.  **Важно**: Попытка исправления выполняется **ТОЛЬКО ОДИН РАЗ** за сессию (используется `useRef(permissionFixAttempted)`), чтобы избежать бесконечного цикла перезагрузок страницы.

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

## 9. Доступность в РФ (Cloudflare Settings)
**⚠️ КРИТИЧНО ДЛЯ РАБОТЫ В РОССИИ ⚠️**

Из-за особенностей блокировок DPI и проблем с IPv6/HTTP3 через прокси Cloudflare, для доменов на Vercel необходимо использовать режим **DNS Only**.

*   **Настройка Cloudflare**:
    1.  Перейти в **DNS** -> **Records**.
    2.  Найти записи `A` (root) и `CNAME` (www).
    3.  Переключить **Proxy status** в состояние **DNS Only** (Серое облако / Grey Cloud).
    4.  Сохранить.

*   **Почему это нужно**:
    *   В режиме "Orange Cloud" (Proxied) Cloudflare принудительно включает IPv6 Compatibility, который часто сбрасывает соединения (ERR_CONNECTION_RESET) у российских провайдеров при загрузке JS-скриптов.
    *   Vercel предоставляет свой собственный SSL и DDoS защиту, поэтому проксирование через Cloudflare не является обязательным для безопасности, но мешает доступности.
