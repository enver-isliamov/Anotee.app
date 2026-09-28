/**
 * T-05: исход попытки обновления проекта при условном (CAS) UPDATE.
 * Вынесено в чистую функцию — покрыто unit-тестами.
 */

/** @returns {{status:'updated', _version:number} | {status:'conflict', serverVersion:number|null, server:object|null}} */
export function resolveSyncOutcome(rowCount, newVersion, serverData) {
    if (rowCount === 0) {
        return {
            status: 'conflict',
            serverVersion: serverData && typeof serverData._version === 'number' ? serverData._version : null,
            server: serverData || null
        };
    }
    return { status: 'updated', _version: newVersion };
}
