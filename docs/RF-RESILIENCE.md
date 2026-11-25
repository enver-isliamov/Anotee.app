# RF-RESILIENCE — доступность Anotee из России

> Цель документа: собрать в одном месте всё, что делает приложение доступным из РФ:
> сетевая схема, настройки Cloudflare, локальный фронтенд-бандл без заблокированных CDN,
> зеркало Whisper-модели и своё хранилище видео (BYOS). Связанные задачи: T-15, T-16, T-17
> в [docs/TASKS.md](TASKS.md). Разделы 1–2 основаны на [docs/SETTINGS.md](SETTINGS.md) §10.

## 1. Текущая схема

```
Пользователь (РФ)
      │  HTTPS (TLS 1.2, без ECH/QUIC — проходит ТСПУ)
      ▼
Cloudflare (оранжевое облако, прокси anotee.com)   ← скрывает IP Vercel от блокировок
      │
      ▼
Vercel (статика dist/ + Serverless Functions api/)
      │
      ├── Google Drive / S3 (BYOS)  — видео-файлы (легаси-URL Drive, presigned GET S3)
      └── HF Hub (huggingface.co + cdn-lfs.huggingface.co) — Whisper-модель
          ⚠ недоступен/нестабилен из РФ → см. §4 (зеркало модели)
```

## 2. Чеклист Cloudflare (проверить в дашборде ⚠)

> **⚠ «Проверить в дашборде»**: перечисленное ниже — целевое состояние из
> [docs/SETTINGS.md](SETTINGS.md) §10; перед релизом сверьте фактические значения
> в панели Cloudflare (оранжевое облако уже включено).

| Где | Настройка | Значение | Зачем |
|---|---|---|---|
| Регистратор | NS-серверы | делегирование на Cloudflare (например `joselyn.ns.cloudflare.com`) | иначе CNAME-настройки ниже не действуют |
| DNS | `CNAME @ → cname.vercel-dns.com` | **Proxied** (оранжевое облако); `A`-записи корня удалить | проксирование + CNAME Flattening |
| DNS | `CNAME www → cname.vercel-dns.com` | **Proxied** (оранжевое облако) | то же для www |
| Network | HTTP/3 (with QUIC) | ⛔ **OFF** | QUIC блокируется ТСПУ |
| Network | 0-RTT Connection Resumption | ⛔ **OFF** | блокируется ТСПУ |
| Network | IPv6 Compatibility | ⛔ **OFF** | через API/консоль |
| SSL/TLS → Edge Certificates | TLS 1.3 | ⛔ **OFF** | автоматически отключает ECH, который ломается на ТСПУ |
| SSL/TLS → Edge Certificates | Minimum TLS Version | **1.2** | см. выше |

## 3. Фронтенд без заблокированных CDN (T-15, T-17)

Прод-сборка не должна обращаться к внешним CDN, недоступным/нестабильным в РФ:

| Что удалено | Было | Стало |
|---|---|---|
| CDN-сборка Tailwind (`cdn.tailwindcss.com`) + inline-конфиг в `index.html` | runtime-JIT в браузере | локальная сборка: `tailwind.config.js` + `postcss.config.js` + `index.css` (подключён в `index.tsx`); `theme.extend` перенесён 1:1, `darkMode:'class'`, плагин `tailwindcss-animate` |
| `importmap` на `esm.sh` в `index.html` | runtime-ESM-импорты | модули бандлит Vite (`npm run build`) |
| `images.unsplash.com` (thumbnails LiveDemo, onError-fallback ProjectView) | внешние картинки | `public/img/demo-video-1.jpg`, `demo-video-2.jpg`, `thumbnail-fallback.jpg` |
| `api.dicebear.com` (аватары) | внешние SVG | `services/avatarUtils.ts` → `generateInitialsAvatar(seed)` (data-URI SVG, инициалы + цвет из `stringToColor`); mock-аватар — `public/img/avatar-mock.svg` |

**Контроль регрессии:** `npm run check:external` — сканирует `dist/index.html` и
`dist/assets/*.css` на запрещённые хосты (`cdn.tailwindcss.com`, `esm.sh`,
`cdn-lfs.huggingface.co`) и падает при их обнаружении. Скрипт включён в CI после build
(`.github/workflows/ci.yml`). ⚠ Известное исключение: fallback-URL unsplash в
`services/utils.ts` остался — фото `photo-1574717024653-61fd2cf4d44c` удалено из CDN
Unsplash (404 от источника), замена требует решения владельца (см. T-17 в TASKS.md).
Мок-данные `constants.ts` (MOCK_PROJECTS) тоже содержат unsplash-URL — вне рамок T-17.

## 4. Whisper-модель: своё зеркало (T-16)

**Проблема.** AI-транскрибация (`components/Player.tsx` → `services/transcriptionWorker.ts`,
transformers.js 3.8.1) грузит модель `Xenova/whisper-tiny` с HF Hub. Бинарники ONNX отдаются
через `cdn-lfs.huggingface.co` — из РФ соединения сбрасываются.

**Механизм.** Воркер читает поле `modelBaseUrl` входящего сообщения; если оно задано и не
равно дефолту (`https://huggingface.co/`), до создания `pipeline` выставляется
`env.remoteHost` (фактическое API transformers.js 3.8.1: `env.remoteHost` +
`env.remotePathTemplate`; шаблон пути `{model}/resolve/{revision}/` остаётся дефолтным).
`env.allowLocalModels=false` и `env.useBrowserCache=true` не изменяются — браузерный кэш
модели работает как раньше. Если `modelBaseUrl` не передан, поведение воркера прежнее.

### 4.1 Как поднять зеркало

1. Возьмём любой статик-хостинг, доступный из РФ (свой VPS + nginx, Object Storage с
   публичным бакетом, Cloudflare R2 + свой домен и т.п.).
2. Скопируйте файлы модели из репозитория [`Xenova/whisper-tiny`](https://huggingface.co/Xenova/whisper-tiny/tree/main)
   (структура сверена с фактическим репо модели; список файлов — через
   `https://huggingface.co/api/models/Xenova/whisper-tiny`):

   ```
   <корень зеркала>/
     Xenova/
       whisper-tiny/
         resolve/
           main/
             config.json
             generation_config.json
             preprocessor_config.json
             tokenizer.json
             tokenizer_config.json
             special_tokens_map.json
             vocab.json
             merges.txt
             added_tokens.json
             normalizer.json
             onnx/
               encoder_model.onnx              ← без dtype=квантования
               encoder_model_quantized.onnx    ← дефолт transformers.js (q8)
               decoder_model_merged.onnx
               decoder_model_merged_quantized.onnx
   ```

   Минимум для работы дефолтных настроек браузера (q8): `config.json`,
   `generation_config.json`, `preprocessor_config.json`, `tokenizer.json`,
   `tokenizer_config.json` + `onnx/encoder_model_quantized.onnx` +
   `onnx/decoder_model_merged_quantized.onnx`. Остальные `.onnx`-варианты (`_fp16`,
   `_int8`, `_q4`, …) можно не копировать, если они не используются; при выборе модели
   `Xenova/whisper-base` в UI скопируйте тот же набор из её репозитория.
3. Структура путей обязана повторять HF Hub — итоговые URL должны иметь вид
   `https://<зеркало>/Xenova/whisper-tiny/resolve/main/config.json` (шаблон
   `{model}/resolve/{revision}/` зашит в transformers.js). Проще всего — reverse-proxy
   `https://<зеркало>/ → https://huggingface.co/` (тогда файлы не копируются вообще).
4. Включите CORS на зеркале: браузерный воркер запрашивает файлы с origin `anotee.com`.

### 4.2 Как включить VITE_WHISPER_MODEL_BASE_URL

1. В `.env` (локально) или в Project Settings → Environment Variables на Vercel добавьте:

   ```
   VITE_WHISPER_MODEL_BASE_URL=https://hf.yourdomain.ru
   ```

   (переменная `VITE_*` подставляется Vite на этапе сборки → требуется rebuild/redeploy).
2. Значение — базовый URL зеркала **без** пути модели (слэш на конце не обязателен).
3. Пусто/не задано → поле `modelBaseUrl` в воркер не передаётся, модель грузится с
   HF Hub как раньше. Если значение равно `https://huggingface.co/` — это эквивалентно
   дефолту, переопределения не происходит.
4. Проверка: DevTools → Network в плеере при «Generate Transcript» — запросы `config.json`
   и `*.onnx` должны идти на зеркало; в UI прогресс скачивания модели работает как раньше.

## 5. Хранилище видео на своём S3 (BYOS, этап XXIII)

Когда Google Drive нестабилен из РФ, пользователи могут подключить собственное
S3-совместимое хранилище (Yandex Object Storage, Selectel, Cloudflare R2) — загрузка
через presigned PUT, воспроизведение через presigned GET (ссылки живут 1 час).

- Пользовательский путь и уровни доступа: [docs/WORKFLOW.md](WORKFLOW.md) §VIII («BYOS»).
- Обязательная CORS-конфигурация бакета и кнопка Auto-CORS: [docs/SETTINGS.md](SETTINGS.md) §6.
- Серверная часть: `api/storage.js` (⚠ связано с T-04 — server-side ограничение ключей проектом).
