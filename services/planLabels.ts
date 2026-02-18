
import { UserPlan } from '../types';
import { Zap, Crown, Circle, Star, Infinity } from 'lucide-react';

export const getPlanLabel = (plan: UserPlan): string => {
    switch(plan) {
        case 'lifetime': return 'Founder (Lifetime)';
        case 'pro': return 'Pro Subscription';
        case 'free': return 'Starter Free';
        default: return 'Free';
    }
};

export const getPlanBadgeClass = (plan: UserPlan): string => {
    switch(plan) {
        case 'lifetime': 
            return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20';
        case 'pro': 
            return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20';
        default: 
            return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
    }
};

export const getPlanIcon = (plan: UserPlan) => {
    switch(plan) {
        case 'lifetime': return Crown;
        case 'pro': return Zap;
        default: return Circle;
    }
};

export const getPlanDescription = (plan: UserPlan): string => {
    switch(plan) {
        case 'lifetime': return 'Вечный доступ. Максимальные лимиты. Нет рекуррентных платежей.';
        case 'pro': return 'Активная подписка. Расширенные функции.';
        default: return 'Базовый тариф. Ограниченные лимиты.';
    }
}
