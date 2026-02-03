
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
        <div className="space-y-8 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed text-justify">
            <div>
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">Публичная оферта</h1>
                <p className="text-xs text-zinc-500">Редакция от {new Date().toLocaleDateString()}</p>
            </div>
            
            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">1. Общие положения</h3>
                <p>1.1. Настоящий документ является официальным предложением (публичной офертой) {CONTACT_INFO.status} {CONTACT_INFO.name} (далее — «Исполнитель» или «Лицензиар») заключить лицензионный договор на предоставление права использования программного обеспечения Anotee (далее — «Сервис») на изложенных ниже условиях.</p>
                <p>1.2. Акцептом (полным и безоговорочным принятием) оферты является совершение Пользователем (Лицензиатом) любого из действий: регистрация в Сервисе, использование функционала Сервиса или оплата Тарифа.</p>
                <p>1.3. Сервис предоставляется на условиях «как есть» (AS IS). Исполнитель не гарантирует, что Сервис будет соответствовать всем ожиданиям Пользователя или работать бесперебойно при любых условиях.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">2. Предмет договора</h3>
                <p>2.1. Исполнитель предоставляет Пользователю простую (неисключительную) лицензию на использование Сервиса Anotee (доступ к облачной платформе) для загрузки медиафайлов, комментирования и совместной работы.</p>
                <p>2.2. Территория использования: весь мир. Срок использования: определяется оплаченным Тарифом.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">3. Стоимость и порядок расчетов</h3>
                <p>3.1. Стоимость лицензии определяется Тарифами, опубликованными на сайте в разделе «Цены» (Pricing).</p>
                <p>3.2. Оплата производится в безналичном порядке через платежного агрегатора ЮKassa.</p>
                <p>3.3. Исполнитель применяет специальный налоговый режим «Налог на профессиональный доход». Чеки формируются и направляются Пользователю в электронном виде на Email.</p>
            </section>

            <section className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                <h3 className="text-lg font-bold text-indigo-700 dark:text-indigo-400 mb-3">4. Подписка и Рекуррентные платежи</h3>
                <p>4.1. При выборе тарифа с периодической оплатой (подписка), Пользователь дает согласие на автоматическое списание денежных средств (рекуррентные платежи) с привязанной банковской карты.</p>
                <p>4.2. Списания производятся согласно выбранному периоду (ежемесячно или ежегодно) за 24 часа до окончания текущего периода.</p>
                <p>4.3. Пользователь может отменить подписку в любой момент в настройках профиля. Действие тарифа сохранится до конца оплаченного периода.</p>
            </section>

            <section className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 mt-6">
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mb-3">5. Политика возврата средств (No Refund Policy)</h3>
                <p>5.1. Услуга по предоставлению доступа к Сервису считается оказанной Исполнителем в полном объеме в момент активации соответствующего статуса (Pro, Founder) в учетной записи Пользователя.</p>
                <p>5.2. В силу нематериальной природы цифрового продукта (Лицензии), возврат денежных средств за качественно предоставленный доступ не производится, даже если Пользователь не воспользовался функционалом.</p>
                <p>5.3. Все претензии по качеству работы Сервиса должны быть направлены на {CONTACT_INFO.email} и рассматриваются в индивидуальном порядке.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">6. Ограничение ответственности</h3>
                <p>6.1. Исполнитель не несет ответственности за:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                    <li>Прямой или косвенный ущерб, включая упущенную выгоду, возникший из-за использования Сервиса.</li>
                    <li>Сохранность данных, размещенных на сторонних сервисах (Google Drive), интегрированных пользователем.</li>
                    <li>Сбои в работе провайдеров аутентификации (Clerk, Google) или хостинга (Vercel).</li>
                </ul>
                <p className="mt-2">6.2. Максимальная совокупная ответственность Исполнителя ограничивается суммой последнего платежа Пользователя.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">7. Пользовательский контент</h3>
                <p>7.1. Пользователь сохраняет исключительные права на загружаемые им видео и файлы.</p>
                <p>7.2. Пользователь гарантирует, что имеет право на использование и загрузку контента. Исполнитель не осуществляет модерацию контента, но оставляет за собой право удалить материалы и заблокировать аккаунт по требованию правообладателей или госорганов.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">8. Заключительные положения</h3>
                <p>8.1. Договор может быть изменен Исполнителем в одностороннем порядке путем публикации новой редакции на Сайте.</p>
                <p>8.2. Применимое право — право Российской Федерации.</p>
            </section>

            <section className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">Реквизиты Исполнителя</h3>
                <div className="text-xs font-mono bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg">
                    <p className="font-bold">{CONTACT_INFO.name}</p>
                    <p>ИНН: {CONTACT_INFO.inn}</p>
                    <p>Email: {CONTACT_INFO.email}</p>
                    <p>Телефон: {CONTACT_INFO.phone}</p>
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
                <p>Настоящая Политика описывает порядок обработки персональных данных при использовании сервиса Anotee. Оператором данных является {CONTACT_INFO.name} (ИНН {CONTACT_INFO.inn}). Мы уважаем вашу конфиденциальность и обрабатываем данные в соответствии с законодательством.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">2. Персональные данные, подлежащие обработке</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Идентификационные данные:</strong> Email, имя, фото профиля (предоставляются через сервис Clerk/Google).</li>
                    <li><strong>Данные контента:</strong> Загруженные видео, комментарии, текстовые расшифровки (транскрипты), названия проектов.</li>
                    <li><strong>Технические данные:</strong> IP-адрес, тип устройства, версия браузера, файлы cookie, логи активности.</li>
                    <li><strong>Платежные данные:</strong> Токен платежного метода и маскированный номер карты (хранятся на стороне ЮKassa, мы получаем только идентификатор для рекуррентных списаний).</li>
                </ul>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">3. Цели обработки персональных данных</h3>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Предоставление доступа к функционалу Сервиса (совместная работа, плеер).</li>
                    <li>Осуществление платежей и управление подписками.</li>
                    <li>Обеспечение безопасности аккаунта и предотвращение мошенничества.</li>
                    <li>Связь с пользователем (техническая поддержка, уведомления об изменениях).</li>
                    <li>Выполнение требований законодательства (налоговый учет).</li>
                </ul>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">4. Передача данных третьим сторонам</h3>
                <p>Для обеспечения работы Сервиса мы используем надежных партнеров. Вы соглашаетесь на передачу (включая трансграничную) данных следующим обработчикам:</p>
                <div className="grid md:grid-cols-2 gap-4 mt-3">
                    <div className="p-3 border rounded border-zinc-200 dark:border-zinc-800">
                        <span className="font-bold block text-zinc-900 dark:text-white">Clerk Inc. (США)</span>
                        <span className="text-xs">Аутентификация, управление сессиями.</span>
                    </div>
                    <div className="p-3 border rounded border-zinc-200 dark:border-zinc-800">
                        <span className="font-bold block text-zinc-900 dark:text-white">Vercel Inc. (США)</span>
                        <span className="text-xs">Хостинг инфраструктуры, базы данных, хранение файлов.</span>
                    </div>
                    <div className="p-3 border rounded border-zinc-200 dark:border-zinc-800">
                        <span className="font-bold block text-zinc-900 dark:text-white">Google LLC (США)</span>
                        <span className="text-xs">Интеграция с Google Drive (по запросу пользователя).</span>
                    </div>
                    <div className="p-3 border rounded border-zinc-200 dark:border-zinc-800">
                        <span className="font-bold block text-zinc-900 dark:text-white">ЮMoney / ЮKassa (РФ)</span>
                        <span className="text-xs">Обработка платежей и чеков.</span>
                    </div>
                </div>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">5. Правовые основания и Сроки хранения</h3>
                <p>5.1. Обработка осуществляется на основании исполнения Договора (Оферты), согласия субъекта и законных интересов Оператора.</p>
                <p>5.2. Персональные данные хранятся в течение срока использования Сервиса и 5 лет после удаления аккаунта (в части, необходимой для налоговой отчетности).</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">6. Права пользователей</h3>
                <p>Вы имеете право:</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Отозвать согласие на обработку (через удаление аккаунта).</li>
                    <li>Запросить копию своих данных.</li>
                    <li>Отменить подписку и удалить платежные методы.</li>
                </ul>
                <p className="mt-2 text-xs">Для реализации прав пишите на {CONTACT_INFO.email}.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">7. Обработка данных пользователями через Anotee</h3>
                <p>В отношении контента (видео), который вы загружаете в Anotee, вы выступаете Оператором данных, а Anotee — Обработчиком. Вы несете ответственность за получение согласия лиц, изображенных на ваших видео, на обработку их изображений в нашем Сервисе.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">8. Использование куки (Cookies)</h3>
                <p>Мы используем технические файлы cookie для авторизации и сохранения настроек интерфейса. Мы не используем сторонние рекламные cookie. Отключение cookie может привести к недоступности Сервиса.</p>
            </section>

            <section>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">9. Автоматизированная обработка</h3>
                <p>Сервис предоставляет функции на базе ИИ (транскрибация речи). Обработка происходит автоматически. Пользователь понимает, что машинная обработка может содержать неточности и не является юридически значимой расшифровкой.</p>
            </section>

            <section className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">Заключение</h3>
                <p>Политика может обновляться. Продолжение использования Сервиса означает согласие с изменениями.</p>
                <div className="mt-4 text-xs text-zinc-500">
                    Контакты: {CONTACT_INFO.email}
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
