
import React from 'react';
import { useLanguage } from '../services/i18n';

interface LegalPageProps {
    type: 'TERMS' | 'PRIVACY';
}

export const LegalPage: React.FC<LegalPageProps> = ({ type }) => {
    const { t } = useLanguage();

    // ЗАМЕНИТЕ ЭТИ ДАННЫЕ НА ВАШИ РЕАЛЬНЫЕ
    const CONTACT_INFO = {
        name: "ИСЛЯМОВ ЭНВЕР ЯКУБОВИЧ", // Например: Иванов Иван Иванович
        inn: "910228340090",
        email: "enver.isliamov@yandex.com", // Например: support@anotee.com
        phone: "+79790662089" // Опционально, но ЮKassa любит, когда есть телефон
    };

    const renderContent = () => {
        if (type === 'TERMS') {
            return (
                <div className="space-y-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">Публичная оферта</h1>
                    
                    <section>
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-2">1. Общие положения</h3>
                        <p>Настоящий документ является официальным предложением (публичной офертой) плательщика налога на профессиональный доход {CONTACT_INFO.name} (далее — «Исполнитель») и содержит все существенные условия предоставления услуг использования сервиса Anotee.</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-2">2. Предмет оферты</h3>
                        <p>Исполнитель предоставляет Заказчику доступ к облачному сервису Anotee для совместной работы над видео (далее — «Сервис») на условиях выбранного Тарифного плана.</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-2">3. Порядок оказания услуг и доставки</h3>
                        <p>3.1. Услуги оказываются в электронном виде.</p>
                        <p>3.2. <strong>Момент оказания услуги:</strong> Услуга считается оказанной в полном объеме в момент предоставления Заказчику доступа к расширенным функциям Сервиса (активация статуса "Pro" или "Founder" в личном кабинете) после поступления оплаты.</p>
                        <p>3.3. Доставка физических товаров не производится.</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-2">4. Стоимость и порядок расчетов</h3>
                        <p>4.1. Стоимость услуг определяется в соответствии с тарифами, опубликованными на сайте.</p>
                        <p>4.2. Оплата производится банковской картой через платежную систему ЮKassa.</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-2">5. Возврат средств</h3>
                        <p>5.1. Так как услуга является предоставлением доступа к цифровому контенту и оказывается в момент оплаты, возврат средств за качественно оказанную услугу не производится, если иное не предусмотрено законодательством РФ.</p>
                        <p>5.2. При возникновении технических проблем с доступом, Заказчик обязан обратиться в поддержку по адресу {CONTACT_INFO.email}.</p>
                    </section>

                    <section className="border-t border-zinc-200 dark:border-zinc-800 pt-6 mt-8">
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-2">Реквизиты Исполнителя</h3>
                        <p>{CONTACT_INFO.name} (Самозанятый)</p>
                        <p>ИНН: {CONTACT_INFO.inn}</p>
                        <p>Email: {CONTACT_INFO.email}</p>
                    </section>
                </div>
            );
        }

        return (
            <div className="space-y-6 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">Политика конфиденциальности</h1>
                <p>Настоящая Политика конфиденциальности описывает, как сервис Anotee собирает, использует и защищает информацию пользователей.</p>
                
                <section>
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-2">1. Сбор данных</h3>
                    <p>Мы собираем только минимально необходимые данные для работы сервиса: Email (через аутентификацию Google/Clerk) и данные, которые вы загружаете в сервис (видео, комментарии).</p>
                </section>

                <section>
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-2">2. Использование данных</h3>
                    <p>Данные используются исключительно для предоставления функционала Сервиса. Мы не передаем ваши данные третьим лицам в рекламных целях.</p>
                </section>

                <section>
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-2">3. Безопасность платежей</h3>
                    <p>При оплате картой мы не получаем и не сохраняем полные данные вашей карты. Обработка платежей происходит на стороне сертифицированного оператора ЮKassa.</p>
                </section>

                <section>
                    <h3 className="font-bold text-zinc-900 dark:text-white mb-2">4. Контакты</h3>
                    <p>По вопросам конфиденциальности пишите на: {CONTACT_INFO.email}</p>
                </section>
            </div>
        );
    };

    return (
        <div className="max-w-3xl mx-auto py-12 px-4">
            {renderContent()}
        </div>
    );
};
