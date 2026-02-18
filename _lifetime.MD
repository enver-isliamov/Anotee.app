
# План реализации Lifetime Tier

## 0) Цель изменений
Сейчас доступы построены на модели free/pro (enabledForFree/enabledForPro), а useSubscription возвращает только pro|free в итоговом plan, из-за чего lifetime-сценарии ломаются/теряются в UI.

## ✅ 1) hooks/useSubscription.ts — источник истины по плану
**Статус:** ✅ Выполнено
Перестать схлопывать plan в pro|free.
Возвращать: `plan: 'free' | 'pro' | 'lifetime'`, `isPro`, `isLifetime`, `isPaid`.

## ✅ 2) types.ts — расширение feature-модели на 3 плана
**Статус:** ✅ Выполнено
В FeatureRule добавить lifetime-ветку: `enabledForLifetime`, `limitLifetime`.
В DEFAULT_CONFIG добавить значения для lifetime.

## ✅ 3) services/entitlements.ts — единая функция доступа
**Статус:** ✅ Выполнено
Созданы хелперы `isFeatureEnabled(config, featureKey, plan)` и `getFeatureLimit(...)`.

## ✅ 4) components/Dashboard.tsx — лимиты и доступы
**Статус:** ✅ Выполнено
Заменить `canShareProject = isPro` и расчет лимитов на вызовы `getFeatureLimit` и `isFeatureEnabled`.

## ✅ 5) components/ProjectView.tsx — invite/public links
**Статус:** ✅ Выполнено
`canInviteTeam` и `canSharePublicLink` считать через helper. Убрать прямую зависимость от `isPro`.

## ✅ 6) components/Profile.tsx — White Label
**Статус:** ✅ Выполнено
`canUseWhiteLabel` считать через helper.

## ✅ 7) components/Player.tsx — экспорты
**Статус:** ✅ Выполнено
В handleExport заменена проверка `if (!isPro)` на проверку `isFeatureEnabled` для `export_xml` и `export_csv`.

## ✅ 8) components/admin/AdminFeaturesTab.tsx — админка фич
**Статус:** ✅ Выполнено
Добавлен третий блок-тоггл "Lifetime" (Founder) в карточки настройки фич.

## ✅ 9) api/cron.js — продления
**Статус:** ✅ Выполнено
Логика обновлена. Cron обрабатывает только пользователей с `plan: 'pro'`. Пользователи с `plan: 'lifetime'` игнорируются явным образом. API выдачи грантов (`api/admin.js`) обновлено для корректной установки плана.

## ✅ 10) Миграция данных
**Статус:** ✅ Решено (Lazy)
Миграция базы данных не требуется в явном виде. Приложение использует `DEFAULT_CONFIG` с fallback-логикой (если lifetime-поля отсутствуют в БД, используются настройки Pro). Полная структура сохраняется в БД при первом сохранении настроек администратором.
