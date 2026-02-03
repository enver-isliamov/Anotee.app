
import React from 'react';
import { useLanguage } from '../services/i18n';

interface LegalPageProps {
    type: 'TERMS' | 'PRIVACY';
}

export const LegalPage: React.FC<LegalPageProps> = ({ type }) => {
    const { t } = useLanguage();

    // КОНТАКТНЫЕ ДАННЫЕ ИСПОЛНИТЕЛЯ
    const CONTACT_INFO = {
        name: "ИСЛЯМОВ ЭНВЕР ЯКУБОВИЧ",
        status: "Плательщик налога на профессиональный доход (Самозанятый)",
        inn: "910228340090",
        email: "enver.isliamov@yandex.com",
        phone: "+79790662089",
        siteUrl: "https://anotee.com" // Замените на реальный домен если отличается
    };

    const renderTerms = () => (
        <div className="space-y-8 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed text-justify">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Публичная оферта</h1>
                <p className="text-xs text-zinc-500">Редакция от {new Date().toLocaleDateString()}</p>
            </div>
            
            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">1. Общие положения</h3>
                <p>1.1. Настоящий документ является официальным предложением (публичной офертой) {CONTACT_INFO.status} {CONTACT_INFO.name} (далее — «Исполнитель» или «Администрация») заключить договор на предоставление права использования программного обеспечения Anotee (далее — «Сервис») на изложенных ниже условиях.</p>
                <p>1.2. Акцептом (полным и безоговорочным принятием) оферты является совершение Пользователем любого из действий: регистрация в Сервисе, использование функционала Сервиса или оплата Тарифа.</p>
                <p>1.3. Сервис предоставляется на условиях лицензии «как есть» (AS IS). Исполнитель не гарантирует, что Сервис будет соответствовать ожиданиям Пользователя или работать бесперебойно.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">2. Предмет договора</h3>
                <p>2.1. Исполнитель предоставляет Пользователю неисключительную лицензию (право доступа) к облачному сервису Anotee для загрузки медиафайлов, комментирования и совместной работы.</p>
                <p>2.2. Объем доступного функционала определяется выбранным Пользователем Тарифом (Free, Pro, Founder и др.).</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">3. Стоимость и порядок расчетов</h3>
                <p>3.1. Стоимость услуг указана на сайте в разделе «Цены» (Pricing).</p>
                <p>3.2. Оплата производится в безналичном порядке через платежного агрегатора ЮKassa.</p>
                <p>3.3. Исполнитель применяет специальный налоговый режим «Налог на профессиональный доход». Чеки формируются и направляются Пользователю в электронном виде.</p>
                <p>3.4. В случае оформления подписки, списания производятся автоматически (рекуррентные платежи) согласно периоду подписки до момента её отмены Пользователем.</p>
            </section>

            <section className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-3">4. Политика возврата средств (No Refund Policy)</h3>
                <p>4.1. Услуга считается оказанной Исполнителем в полном объеме и надлежащего качества в момент предоставления Пользователю доступа к расширенному функционалу Сервиса (активация статуса в Личном кабинете) сразу после оплаты.</p>
                <p>4.2. В соответствии с законодательством РФ, право использования программного обеспечения (лицензия) и цифровой контент, к которому предоставлен доступ, возврату не подлежат.</p>
                <p>4.3. <strong>Возврат денежных средств не производится</strong> ни при каких обстоятельствах, включая, но не ограничиваясь: отсутствие использования Сервиса Пользователем, субъективная неудовлетворенность функционалом, блокировка аккаунта за нарушение правил.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">5. Ограничение ответственности</h3>
                <p>5.1. Исполнитель не несет ответственности за:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li>Сохранность данных Пользователя, размещенных на сторонних сервисах (Google Drive, Vercel Blob и др.), интегрированных с Anotee.</li>
                    <li>Сбои в работе сервисов аутентификации (Clerk, Google Auth).</li>
                    <li>Любые убытки (включая упущенную выгоду), возникшие в результате использования или невозможности использования Сервиса.</li>
                    <li>Контент, загружаемый Пользователем. Пользователь гарантирует, что обладает всеми правами на загружаемые видео и файлы.</li>
                </ul>
                <p className="mt-2">5.2. Максимальная ответственность Исполнителя по любым искам ограничивается суммой, фактически уплаченной Пользователем за последний отчетный период.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">6. Интеллектуальная собственность</h3>
                <p>6.1. Исключительные права на программный код, дизайн и название Anotee принадлежат Исполнителю.</p>
                <p>6.2. Пользователь сохраняет все права на загружаемый им контент. Пользователь предоставляет Исполнителю право хранить и обрабатывать этот контент исключительно для целей функционирования Сервиса.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">7. Срок действия и расторжение</h3>
                <p>7.1. Договор вступает в силу с момента Акцепта и действует бессрочно (до удаления аккаунта).</p>
                <p>7.2. Исполнитель имеет право заблокировать доступ Пользователя без возврата средств в случае нарушения условий данной оферты или законодательства РФ.</p>
            </section>

            <section className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">Реквизиты Исполнителя</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg">
                    <div>
                        <p className="font-bold">{CONTACT_INFO.name}</p>
                        <p>{CONTACT_INFO.status}</p>
                        <p>ИНН: {CONTACT_INFO.inn}</p>
                    </div>
                    <div>
                        <p>Email для связи: <a href={`mailto:${CONTACT_INFO.email}`} className="text-indigo-500 hover:underline">{CONTACT_INFO.email}</a></p>
                        <p>Телефон: {CONTACT_INFO.phone}</p>
                    </div>
                </div>
            </section>
        </div>
    );

    const renderPrivacy = () => (
        <div className="space-y-8 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed text-justify">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Политика конфиденциальности</h1>
                <p className="text-xs text-zinc-500">Последнее обновление: {new Date().toLocaleDateString()}</p>
            </div>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">1. Общие положения</h3>
                <p>Настоящая Политика определяет порядок обработки и защиты информации о физических лицах (Пользователях), пользующихся сервисом Anotee. Оператором данных является {CONTACT_INFO.name} (ИНН {CONTACT_INFO.inn}).</p>
                <p>Используя Сервис, вы выражаете свое полное согласие с условиями настоящей Политики.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">2. Персональные данные, подлежащие обработке</h3>
                <p>Мы обрабатываем следующие данные:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li><strong>Учетные данные:</strong> Адрес электронной почты, имя, фото профиля (полученные через сервисы авторизации Clerk/Google).</li>
                    <li><strong>Пользовательский контент:</strong> Загруженные видеофайлы, комментарии, названия проектов, метаданные файлов.</li>
                    <li><strong>Технические данные:</strong> IP-адрес, тип браузера, файлы cookie, логи действий в системе.</li>
                    <li><strong>Платежные данные:</strong> Мы не храним полные данные карт. Мы получаем только маскированный номер карты и токен платежа от оператора ЮKassa.</li>
                </ul>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">3. Цели обработки данных</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Предоставление функционала Сервиса (совместная работа над видео).</li>
                    <li>Идентификация стороны в рамках соглашений.</li>
                    <li>Связь с Пользователем, направление уведомлений и запросов.</li>
                    <li>Проведение статистических и иных исследований на основе обезличенных данных.</li>
                    <li>Исполнение требований законодательства РФ (в т.ч. налогового).</li>
                </ul>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">4. Передача данных третьим сторонам</h3>
                <p>Для работы Сервиса мы используем сторонние инфраструктурные решения. Вы соглашаетесь на трансграничную передачу данных следующим обработчикам:</p>
                <div className="grid md:grid-cols-2 gap-4 mt-3">
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-800">
                        <span className="font-bold block">Clerk Inc. (США)</span>
                        <span className="text-xs">Аутентификация и управление пользователями.</span>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-800">
                        <span className="font-bold block">Google LLC (США)</span>
                        <span className="text-xs">Интеграция с Google Drive, авторизация.</span>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-800">
                        <span className="font-bold block">Vercel Inc. (США)</span>
                        <span className="text-xs">Хостинг приложения и базы данных.</span>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-800">
                        <span className="font-bold block">ООО НКО «ЮМани» (РФ)</span>
                        <span className="text-xs">Обработка платежей (ЮKassa).</span>
                    </div>
                </div>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">5. Правовые основания и Сроки хранения</h3>
                <p>5.1. Обработка осуществляется на основании исполнения договора (Оферты) и согласия субъекта.</p>
                <p>5.2. Персональные данные хранятся до момента удаления аккаунта Пользователем. Данные о платежах хранятся в течение 5 лет в соответствии с налоговым законодательством РФ.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">6. Права пользователей</h3>
                <p>Пользователь имеет право:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li>Отозвать согласие на обработку данных (удалить аккаунт).</li>
                    <li>Запросить информацию о своих хранящихся данных.</li>
                    <li>Требовать уточнения данных.</li>
                </ul>
                <p className="mt-2 text-xs italic">Для реализации прав пишите на: {CONTACT_INFO.email}</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">7. Использование Cookie</h3>
                <p>Мы используем файлы cookie для сохранения сессии авторизации, настроек языка и темы оформления. Отключение cookie может привести к невозможности использования Сервиса.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">8. Автоматизированная обработка</h3>
                <p>Сервис использует автоматизированные алгоритмы для транскрибации аудио (AI) и генерации прокси-файлов. Пользователь понимает, что данные процессы выполняются машинами и могут содержать неточности.</p>
            </section>

            <section className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">Заключение</h3>
                <p>Администрация оставляет за собой право вносить изменения в Политику. Новая редакция вступает в силу с момента ее размещения. Продолжение использования Сервиса означает принятие новой редакции.</p>
                <div className="mt-4 text-xs text-zinc-500">
                    Контакты для юридических запросов: {CONTACT_INFO.email}
                </div>
            </section>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto py-12 px-4 md:px-8">
            {type === 'TERMS' ? renderTerms() : renderPrivacy()}
        </div>
    );
};
