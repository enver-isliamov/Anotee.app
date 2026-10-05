export declare function applyCommentAction(
    comments: Array<{ id: string } & Record<string, unknown>>,
    action: 'create' | 'update' | 'delete',
    payload: { id: string } & Record<string, unknown>,
    userId: string
): { status: 'created' | 'exists' | 'updated' | 'deleted' | 'missing' | 'noop' };
