
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
