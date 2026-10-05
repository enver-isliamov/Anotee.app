export declare const ROADMAP_TYPES: readonly string[];
export declare const ROADMAP_STATUSES: readonly string[];
export declare function sanitizeRoadmapPostInput(
    input: unknown
): { ok: true; value: { title: string; description: string; type: string } } | { ok: false; error: string };
export declare function toggleRoadmapVote(
    post: { voterIds?: string[] },
    userId: string
): { voterIds: string[]; voted: boolean };
export declare function normalizeRoadmapStatus(status: unknown): string | null;
