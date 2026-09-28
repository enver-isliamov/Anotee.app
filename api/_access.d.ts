export declare const STRUCTURAL_PROJECT_FIELDS: string[];
export declare function isKeyInProject(key: unknown, projectId: unknown): boolean;
export declare function areKeysInProject(keys: unknown, projectId: unknown): boolean;
export declare function canManageProject(user: unknown, projectRow: unknown): boolean;
export declare function touchesStructuralFields(updates: unknown): boolean;
export declare function stripStructuralChanges(incoming: unknown, existing: unknown): Record<string, unknown>;
