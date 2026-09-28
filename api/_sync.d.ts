export declare function resolveSyncOutcome(
    rowCount: number,
    newVersion: number,
    serverData: unknown
): { status: 'updated'; _version: number } | { status: 'conflict'; serverVersion: number | null; server: unknown };
