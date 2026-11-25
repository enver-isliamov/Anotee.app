/**
 * ISS-011: единая точка серверного логирования.
 * - logInfo/logWarn/logError пишут всегда (важные события: платежи, аудит, ошибки);
 * - logDebug пишет только при DEBUG_LOGS=1 (шумные трассировки запросов).
 * Прямые console.log в api/* больше не используются.
 */

const debugEnabled = () => process.env.DEBUG_LOGS === '1' || process.env.DEBUG_LOGS === 'true';

export function logInfo(tag, ...args) {
    console.log('[' + tag + ']', ...args);
}

export function logDebug(tag, ...args) {
    if (debugEnabled()) console.log('[debug:' + tag + ']', ...args);
}

export function logWarn(tag, ...args) {
    console.warn('[' + tag + ']', ...args);
}

export function logError(tag, ...args) {
    console.error('[' + tag + ']', ...args);
}
