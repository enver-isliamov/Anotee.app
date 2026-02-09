
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
        siteUrl: "https://anotee.com"
    };

    const renderTerms = () => (
        <div className="space-y-8 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed text-justify pb-12">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Лицензионный договор-оферта</h1>
                <p className="text-xs text-zinc-500">Редакция от {new Date().toLocaleDateString()}</p>
            </div>
            
            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">1. Общие положения</h3>
                <p>1.1. Настоящий документ в соответствии со ст. 437 Гражданского кодекса РФ является официальным публичным предложением (Офертой) {CONTACT_INFO.status} {CONTACT_INFO.name} (далее — «Лицензиар») заключить договор на право использования программного обеспечения Anotee (далее — «Сервис» или «ПО»).</p>
                <p>1.2. Акцептом (полным и безоговорочным принятием) Оферты считается совершение Пользователем (Лицензиатом) любого из действий: регистрация на сайте {CONTACT_INFO.siteUrl}, использование функционала Сервиса или оплата Тарифа.</p>
                <p>1.3. Сервис предоставляется на условиях «как есть» (AS IS). Лицензиар не гарантирует, что ПО будет соответствовать ожиданиям Пользователя, работать бесперебойно или без ошибок, и не несет ответственности за прямые или косвенные убытки, возникшие в результате использования ПО.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">2. Предмет договора и Права использования</h3>
                <p>2.1. Лицензиар предоставляет Пользователю простую (неисключительную) лицензию на использование Сервиса в пределах функциональных возможностей, определяемых выбранным Тарифом.</p>
                <p>2.2. Территория использования: весь мир. Срок использования: определяется сроком действия оплаченной подписки или бессрочно (для тарифов Lifetime).</p>
                <p>2.3. Пользователю запрещается: декомпилировать код, создавать копии ПО, передавать данные учетной записи третьим лицам (за исключением членов команды в рамках функционала Team), использовать ПО для нарушения законодательства.</p>
            </section>

            <section className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-xl">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">3. Стоимость и порядок расчетов</h3>
                <p>3.1. Стоимость лицензии определяется Тарифами, опубликованными на сайте. Лицензиар имеет право изменять тарифы в одностороннем порядке (для новых периодов подписки).</p>
                <p className="mt-2">3.2. Оплата производится в безналичном порядке через платежных агентов (Prodamus/ЮKassa). Моментом исполнения обязательства по оплате считается зачисление средств на счет Лицензиара.</p>
                <p className="mt-2">3.3. Лицензиар применяет специальный налоговый режим «Налог на профессиональный доход». НДС не облагается. Чеки формируются и направляются Пользователю в электронном виде.</p>
            </section>

            <section className="bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                <h3 className="text-lg font-bold text-indigo-700 dark:text-indigo-400 mb-3">4. Подписка и Автоматическое продление</h3>
                <p>4.1. При оплате Тарифа с периодическим списанием (подписка), Пользователь соглашается на безакцептное списание денежных средств с привязанной банковской карты (рекуррентные платежи).</p>
                <p className="mt-2">4.2. Списание происходит за 24 часа до окончания текущего оплаченного периода. В случае неудачи попытки повторяются в течение 3 дней.</p>
                <p className="mt-2">4.3. Пользователь вправе отменить автопродление в любой момент в Личном кабинете. В этом случае доступ к расширенному функционалу сохраняется до конца оплаченного периода.</p>
            </section>

            <section className="bg-red-50 dark:bg-red-900/10 p-5 rounded-xl border border-red-100 dark:border-red-900/30 mt-6">
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-3">5. Отказ от возврата средств (No Refund Policy)</h3>
                <p>5.1. Поскольку предметом договора является предоставление права использования ПО (лицензия), услуга считается оказанной в полном объеме в момент предоставления доступа (активации статуса в Личном кабинете).</p>
                <p className="mt-2">5.2. В соответствии с законодательством РФ, лицензионные договоры на ПО не подлежат расторжению с возвратом средств за неиспользованный период, если доступ был предоставлен технически корректно.</p>
                <p className="mt-2">5.3. Возврат средств возможен исключительно в случае технической ошибки (двойное списание) по письменному заявлению на {CONTACT_INFO.email}.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">6. Ограничение ответственности</h3>
                <p>6.1. Лицензиар ни при каких обстоятельствах не несет ответственности за:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2 text-zinc-600 dark:text-zinc-400">
                    <li>Любые косвенные убытки, упущенную выгоду, потерю данных или деловой репутации.</li>
                    <li>Сбои в работе сервисов третьих лиц, включая: хостинг-провайдеров (Vercel), сервисов авторизации (Clerk, Google), облачных хранилищ (Google Drive API) и платежных систем.</li>
                    <li>Качество доступа к сети Интернет у Пользователя.</li>
                </ul>
                <p className="mt-2">6.2. Максимальная совокупная ответственность Лицензиара по любым искам ограничивается суммой, фактически уплаченной Пользователем за последний отчетный период (месяц/год).</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">7. Интеллектуальная собственность</h3>
                <p>7.1. Исключительные права на ПО Anotee, дизайн и исходный код принадлежат Лицензиару.</p>
                <p>7.2. Исключительные права на контент (видео, изображения, тексты), загружаемый Пользователем, сохраняются за Пользователем. Лицензиар не приобретает прав на контент Пользователя, кроме права на его техническое хранение и обработку для целей функционирования Сервиса.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">8. Разрешение споров и Применимое право</h3>
                <p>8.1. Ко всем отношениям по настоящему Договору применяется право Российской Федерации.</p>
                <p>8.2. Претензионный порядок разрешения споров обязателен. Срок рассмотрения претензии — 30 календарных дней с момента получения на email {CONTACT_INFO.email}.</p>
                <p>8.3. В случае недостижения согласия споры подлежат рассмотрению в суде по месту нахождения Лицензиара (договорная подсудность).</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">9. Форс-мажор</h3>
                <p>9.1. Стороны освобождаются от ответственности за неисполнение обязательств, если оно вызвано обстоятельствами непреодолимой силы: стихийные бедствия, военные действия, блокировки интернет-ресурсов государственными органами (РКН), санкционные ограничения, сбои в работе глобальной сети Интернет.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">10. Срок действия и Расторжение</h3>
                <p>10.1. Договор вступает в силу с момента Акцепта и действует до момента удаления аккаунта Пользователем или Лицензиаром.</p>
                <p>10.2. Лицензиар вправе в одностороннем порядке заблокировать аккаунт Пользователя без возврата средств в случае нарушения условий настоящего Договора (включая спам, попытки взлома, нарушение авторских прав).</p>
            </section>

            <section className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">Реквизиты Исполнителя</h3>
                <div className="text-xs font-mono bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <p className="font-bold text-sm mb-2">{CONTACT_INFO.name}</p>
                    <p>{CONTACT_INFO.status}</p>
                    <p>ИНН: {CONTACT_INFO.inn}</p>
                    <p>Email: {CONTACT_INFO.email}</p>
                    <p>Телефон: {CONTACT_INFO.phone}</p>
                </div>
            </section>
        </div>
    );

    const renderPrivacy = () => (
        <div className="space-y-8 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed text-justify pb-12">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Политика конфиденциальности</h1>
                <p className="text-xs text-zinc-500">Редакция от {new Date().toLocaleDateString()}</p>
            </div>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">1. Общие положения</h3>
                <p>1.1. Настоящая Политика определяет порядок обработки и защиты информации о физических лицах (Пользователях), пользующихся сервисом Anotee. Оператором данных является {CONTACT_INFO.name}.</p>
                <p>1.2. Регистрируясь в Сервисе, Пользователь выражает свое полное согласие с условиями настоящей Политики в соответствии с ФЗ-152 «О персональных данных».</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">2. Состав собираемых данных</h3>
                <ul className="list-disc pl-5 space-y-2 mt-2">
                    <li><strong>Данные аккаунта:</strong> Email, имя, изображение профиля (полученные через сервисы авторизации Google/Clerk).</li>
                    <li><strong>Пользовательский контент:</strong> Названия проектов, текстовые комментарии, метаданные загружаемых файлов.</li>
                    <li><strong>Технические данные:</strong> IP-адрес, тип браузера, файлы cookie, логи доступа.</li>
                    <li><strong>Платежные данные:</strong> Оператор не хранит полные реквизиты банковских карт. Хранятся только обезличенные токены (Payment Tokens) для рекуррентных списаний, предоставляемые платежным шлюзом.</li>
                </ul>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">3. Цели обработки данных</h3>
                <p>Мы используем данные исключительно для:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li>Идентификации стороны в рамках соглашений с Сервисом.</li>
                    <li>Предоставления функционала (хранение проектов, уведомления).</li>
                    <li>Связи с Пользователем (техническая поддержка, отправка чеков).</li>
                    <li>Улучшения качества Сервиса и аналитики.</li>
                </ul>
            </section>

            <section className="bg-zinc-50 dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">4. Передача данных третьим лицам и Трансграничная передача</h3>
                <p>4.1. Для функционирования Сервиса мы используем надежных партнеров. Вы соглашаетесь на передачу части данных следующим обработчикам:</p>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <div className="p-3 border rounded border-zinc-200 dark:border-zinc-800">
                        <span className="font-bold block text-zinc-900 dark:text-white">Clerk Inc. (США)</span>
                        <span className="text-xs text-zinc-500">Аутентификация и управление сессиями</span>
                    </div>
                    <div className="p-3 border rounded border-zinc-200 dark:border-zinc-800">
                        <span className="font-bold block text-zinc-900 dark:text-white">Vercel Inc. (США)</span>
                        <span className="text-xs text-zinc-500">Хостинг, База данных, Serverless функции</span>
                    </div>
                    <div className="p-3 border rounded border-zinc-200 dark:border-zinc-800">
                        <span className="font-bold block text-zinc-900 dark:text-white">Google LLC (США)</span>
                        <span className="text-xs text-zinc-500">Интеграция с Google Drive API</span>
                    </div>
                    <div className="p-3 border rounded border-zinc-200 dark:border-zinc-800">
                        <span className="font-bold block text-zinc-900 dark:text-white">ЮKassa / Prodamus (РФ)</span>
                        <span className="text-xs text-zinc-500">Обработка платежей и фискализация</span>
                    </div>
                </div>
                <p className="mt-4 text-xs text-zinc-500">4.2. Трансграничная передача данных осуществляется в страны, обеспечивающие адекватную защиту прав субъектов персональных данных, либо на основании согласия Пользователя в целях исполнения договора.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">5. Безопасность</h3>
                <p>Мы принимаем необходимые организационные и технические меры для защиты персональных данных от неправомерного доступа. Используется шифрование трафика (SSL/TLS), безопасное хранение паролей (на стороне провайдера Clerk) и регулярные бэкапы.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">6. Использование Cookie</h3>
                <p>Сервис использует файлы cookie для сохранения настроек пользователя (язык, тема) и поддержания авторизованной сессии. Отключение cookie может привести к невозможности использования Сервиса.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">7. Изменение и удаление данных</h3>
                <p>Пользователь может в любой момент изменить свои данные в Личном кабинете или потребовать полного удаления аккаунта и всех связанных данных, направив запрос на {CONTACT_INFO.email}. Срок обработки запроса — до 30 дней.</p>
            </section>

            <section className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">Контакты Оператора</h3>
                <div className="mt-4 text-xs text-zinc-500">
                    По всем вопросам касательно обработки персональных данных пишите на: <a href={`mailto:${CONTACT_INFO.email}`} className="text-indigo-500 hover:underline">{CONTACT_INFO.email}</a>
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
