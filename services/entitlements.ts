
import { AppConfig, UserPlan } from '../types';

export type { UserPlan };

/**
 * Determines if a feature is enabled for a specific plan based on configuration.
 */
export const isFeatureEnabled = (config: AppConfig, key: keyof AppConfig, plan: UserPlan): boolean => {
    const rule = config[key];
    if (!rule) return false;

    switch (plan) {
        case 'lifetime':
            // Fallback to Pro setting if Lifetime explicit setting is missing (backward compatibility)
            return rule.enabledForLifetime ?? rule.enabledForPro;
        case 'pro':
            return rule.enabledForPro;
        case 'free':
        default:
            return rule.enabledForFree;
    }
};

/**
 * Returns the numeric limit for a feature based on the plan.
 * Used for things like max_projects.
 */
export const getFeatureLimit = (config: AppConfig, key: keyof AppConfig, plan: UserPlan): number => {
    const rule = config[key];
    if (!rule) return 0;

    switch (plan) {
        case 'lifetime':
            return rule.limitLifetime ?? rule.limitPro ?? 10000;
        case 'pro':
            return rule.limitPro ?? 1000;
        case 'free':
        default:
            return rule.limitFree ?? 3;
    }
};
