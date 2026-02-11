
import { Project, User, ProjectAsset, Comment } from '../types';
import { MOCK_PROJECTS } from '../constants';
import { generateId } from './utils';

// Detect environment
const ENV = (import.meta as any).env || {};
const HAS_CLERK_KEY = ENV.VITE_CLERK_PUBLISHABLE_KEY && !ENV.VITE_CLERK_PUBLISHABLE_KEY.includes('placeholder');
const IS_MOCK_MODE = !HAS_CLERK_KEY;

const STORAGE_KEY = 'anotee_projects_data';

// Helper to get local data
const getLocalData = (): Project[] => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : MOCK_PROJECTS;
    } catch {
        return MOCK_PROJECTS;
    }
};

const setLocalData = (data: Project[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// Internal token provider function
let clerkTokenProvider: (() => Promise<string | null>) | null = null;

const getAuthToken = async (): Promise<string | null> => {
    // Only use Clerk Token
    if (clerkTokenProvider) {
        try {
            const token = await clerkTokenProvider();
            if (token) return token;
        } catch (e) {
            console.warn("Failed to retrieve Clerk token", e);
        }
    }
    return null;
};

export const api = {
    isMockMode: IS_MOCK_MODE,

    // Dependency Injection for Auth
    setTokenProvider: (provider: () => Promise<string | null>) => {
        clerkTokenProvider = provider;
    },

    checkUpdates: async (orgId?: string): Promise<number> => {
        if (IS_MOCK_MODE) return 0;
        try {
            const token = await getAuthToken();
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            let url = '/api/check-updates';
            if (orgId) url += `?orgId=${orgId}`;
            
            const res = await fetch(url, { headers });
            if (!res.ok) return 0;
            const data = await res.json();
            return data.lastModified || 0;
        } catch (e) {
            return 0;
        }
    },

    getProjects: async (user: User | null, explicitToken?: string | null, orgId?: string, projectId?: string, assetId?: string): Promise<Project[]> => {
        if (IS_MOCK_MODE) {
            // Simulate network delay
            await new Promise(r => setTimeout(r, 600));
            let data = getLocalData();
            if (projectId) {
                const found = data.find(p => p.id === projectId);
                return found ? [found] : [];
            }
            if (orgId) {
                data = data.filter(p => p.orgId === orgId);
            } else {
                data = data.filter(p => !p.orgId);
            }
            return data;
        }

        if (!user) return [];
        
        try {
            const token = explicitToken || await getAuthToken();
            
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            let url = '/api/data';
            const params = new URLSearchParams();
            if (orgId) params.append('orgId', orgId);
            if (projectId) params.append('projectId', projectId);
            if (assetId) params.append('assetId', assetId); // Pass assetId for sandboxing
            if (params.toString()) url += `?${params.toString()}`;

            const res = await fetch(url, { headers });
            
            if (!res.ok) throw new Error("Failed to fetch");
            const data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch (e) {
            console.error("API Fetch Error", e);
            return [];
        }
    },

    syncProjects: async (projects: Project[], user: User, explicitToken?: string | null) => {
        if (IS_MOCK_MODE) {
            await new Promise(r => setTimeout(r, 300));
            const current = getLocalData();
            const updated = current.map(p => {
                const update = projects.find(up => up.id === p.id);
                return update ? update : p;
            });
            projects.forEach(p => {
                if (!updated.find(up => up.id === p.id)) updated.push(p);
            });
            setLocalData(updated);
            return projects.map(p => ({ id: p.id, _version: (p._version || 0) + 1 }));
        }

        const token = explicitToken || await getAuthToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/data', {
            method: 'POST',
            headers,
            body: JSON.stringify(projects)
        });

        if (!res.ok) {
            if (res.status === 409) {
                const err: any = new Error("Conflict");
                err.code = 'CONFLICT';
                throw err;
            }
            throw new Error("Sync failed");
        }
        
        const data = await res.json();
        return data.updates;
    },

    patchProject: async (projectId: string, updates: Partial<Project>, _version: number) => {
        if (IS_MOCK_MODE) {
            const current = getLocalData();
            const idx = current.findIndex(p => p.id === projectId);
            if (idx !== -1) {
                current[idx] = { ...current[idx], ...updates, updatedAt: 'Just now' };
                setLocalData(current);
            }
            return;
        }

        const token = await getAuthToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/data', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ projectId, updates, _version })
        });

        if (!res.ok) {
            if (res.status === 409) {
                const err: any = new Error("Conflict");
                err.code = 'CONFLICT';
                throw err;
            }
            throw new Error("Patch failed");
        }
    },

    deleteAssets: async (urls: string[], projectId: string) => {
        if (IS_MOCK_MODE) return;

        const token = await getAuthToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await fetch('/api/delete', {
            method: 'POST',
            headers,
            body: JSON.stringify({ urls, projectId })
        });
    },

    comment: async (projectId: string, assetId: string, versionId: string, action: 'create'|'update'|'delete', payload: any, user: User) => {
        if (IS_MOCK_MODE) return;

        const token = await getAuthToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/comment', {
            method: 'POST',
            headers,
            body: JSON.stringify({ projectId, assetId, versionId, action, payload })
        });

        if (!res.ok) throw new Error("Comment action failed");
        return await res.json();
    }
};
