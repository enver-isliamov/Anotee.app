вот практичный diff‑план по файлам, чтобы lifetime был отдельным уровнем, а не “как Pro”.

0) Цель изменений
Сейчас доступы построены на модели free/pro (enabledForFree/enabledForPro), а useSubscription возвращает только pro|free в итоговом plan, из-за чего lifetime-сценарии ломаются/теряются в UI. 

1) hooks/useSubscription.ts — источник истины по плану
Что поменять
Перестать схлопывать plan в pro|free.

Возвращать:

plan: 'free' | 'pro' | 'lifetime'

isPro

isLifetime

isPaid (или isActiveSubscription)

Проверку по дате (expiresAt) оставить как валидацию активности.

Почему
Сейчас plan в return подменяется на pro/free, поэтому lifetime теряется. 

2) types.ts — расширение feature-модели на 3 плана
Что поменять
В FeatureRule добавить lifetime-ветку:

enabledForLifetime: boolean

limitLifetime?: number

В DEFAULT_CONFIG добавить значения для lifetime по каждой фиче.

Почему
Сейчас в модели есть только Free/Pro, и нельзя выразить “Lifetime ≠ Pro”. 

3) services/entitlements.ts (новый файл) — единая функция доступа
Что добавить
getPlan(userMeta) / isPlanActive(...)

isFeatureEnabled(config, featureKey, plan)

getPlanLimit(config, featureKey, plan) (для max_projects и т.п.)

Почему
Сейчас проверки разбросаны по UI (тернарники isPro ? ... : ...), их тяжело синхронизировать.
Примеры таких проверок есть в Dashboard/ProjectView/Profile. 

4) components/Dashboard.tsx — лимиты и доступы через plan-aware helper
Что поменять
Заменить:

canShareProject = isPro ? ...

currentLimit = isPro ? limitPro : limitFree

На plan-aware вызовы через helper (free/pro/lifetime).

Почему
Сейчас логика бинарная и не поддерживает отдельный lifetime-профиль. 

5) components/ProjectView.tsx — invite/public links
Что поменять
canInviteTeam и canSharePublicLink считать через новый helper и текущий plan.

Убрать прямую зависимость от isPro.

Почему
Сейчас доступ к sharing фичам двоичный Free/Pro. 

6) components/Profile.tsx — White Label
Что поменять
canUseWhiteLabel считать через plan-aware helper.

Почему
Сейчас White Label также завязан на isPro тернарником. 

7) components/Player.tsx — экспорты
Что поменять
В handleExport заменить проверку if (!isPro && !isDemo) на проверку entitlement по текущему plan.

Почему
Сейчас экспорт допускается только в Pro (или demo), lifetime отдельно не учитывается. 

8) components/admin/AdminFeaturesTab.tsx — админка фич на 3 уровня
Что поменять
Добавить третий блок-тоггл Lifetime рядом с Free/Pro.

Для лимитируемых фич — поле limitLifetime.

Сохранение/загрузка конфига оставить совместимым (миграция defaults).

Почему
Сейчас админка умеет только Free/Pro. 

9) api/cron.js — продления только для Pro (и это ок)
Что проверить/зафиксировать
Оставить renew только для plan === 'pro'.

Для lifetime — без автопродления (как и сейчас по смыслу).

Почему
Крон уже смотрит только pro + payment method — это соответствует идее “lifetime отдельный план без рекуррента”. 

10) (Опционально) миграция данных/обратная совместимость
Что сделать
При чтении config: если enabledForLifetime нет, подставлять безопасный default (например, как Pro или по продуктовой политике).

Один раз пройтись по сохранённым feature_flags и дозаполнить поля.

Рекомендуемый порядок внедрения (чтобы не сломать прод)
types.ts (новая схема FeatureRule + defaults).

services/entitlements.ts (helper).

hooks/useSubscription.ts (возврат raw plan + флаги).

UI-потребители по одному: Dashboard → ProjectView → Profile → Player.

AdminFeaturesTab.tsx (третий тумблер + лимиты).

Проверка крона/платежей и smoke по 3 планам.

Acceptance criteria (готовность)
Пользователь с plan='lifetime' получает свой набор прав, отличный от Pro.

В коде нет критичных isPro ? ... : ... там, где должен учитываться третий план.

Админ может управлять фичами отдельно для Free/Pro/Lifetime.

Карточки тарифов и реальные entitlements не расходятся.