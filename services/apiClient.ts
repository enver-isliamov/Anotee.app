
import { Project, User, ProjectAsset, Comment } from '../types';
import { MOCK_PROJECTS } from '../constants';
import { generateId } from './utils';

// Detect environment
const ENV = (import.meta as any).env || {};
const HAS_CLERK_KEY = ENV.VITE_CLERK_PUBLISHABLE_KEY && !ENV.VITE_CLERK_PUBLISHABLE_KEY.includes('placeholder');
const IS_MOCK_MODE = !HAS_CLERK_KEY;

const STORAGE_KEY = 'smotree_projects_data';

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

    getProjects: async (user: User | null, explicitToken?: string | null, orgId?: string): Promise<Project[]> => {
        if (IS_MOCK_MODE) {
            // Simulate network delay
            await new Promise(r => setTimeout(r, 600));
            let data = getLocalData();
            // Mock filter
            if (orgId) {
                data = data.filter(p => p.orgId === orgId);
            } else {
                data = data.filter(p => !p.orgId);
            }
            return data;
        }

        if (!user) return [];
        
        try {
            // Use explicit token if provided (fixes race condition), otherwise use provider
            const token = explicitToken || await getAuthToken();
            
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const url = orgId ? `/api/data?orgId=${orgId}` : '/api/data';
            const res = await fetch(url, { headers });
            
            if (res.status === 401) {
                console.error("Unauthorized request to /api/data. Token present:", !!token);
                throw new Error("Unauthorized");
            }
            
            if (!res.ok) throw new Error(res.statusText);
            return await res.json();
        } catch (e) {
            console.error("API Get Error", e);
            throw e;
        }
    },

    syncProjects: async (projects: Project[], user: User | null, explicitToken?: string | null): Promise<any[]> => {
        if (IS_MOCK_MODE) {
            setLocalData(projects);
            return [];
        }

        if (!user) return [];

        try {
            const token = explicitToken || await getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // Sanitize data (remove local blob urls before sending to server)
            const cleanData = projects.map(p => ({
                ...p,
                assets: p.assets.map(a => ({
                    ...a,
                    versions: a.versions.map(v => {
                        const { localFileUrl, localFileName, ...rest } = v;
                        return rest;
                    })
                }))
            }));

            const res = await fetch('/api/data', {
                method: 'POST',
                headers,
                body: JSON.stringify(cleanData)
            });

            if (res.status === 409) {
                const errData = await res.json();
                const e: any = new Error("Version Conflict");
                e.code = "CONFLICT";
                e.details = errData;
                throw e;
            }

            if (!res.ok) {
                throw new Error(`Sync failed: ${res.statusText}`);
            }

            const data = await res.json();
            return data.updates || []; // Return updated versions info
        } catch (e) {
            console.error("API Sync Error", e);
            throw e; // Propagate error to UI
        }
    },

    patchProject: async (projectId: string, updates: Partial<Project>, currentVersion: number): Promise<Project> => {
        if (IS_MOCK_MODE) {
            const local = getLocalData();
            const idx = local.findIndex(p => p.id === projectId);
            if (idx !== -1) {
                local[idx] = { ...local[idx], ...updates };
                setLocalData(local);
                return local[idx];
            }
            throw new Error("Mock: Project not found");
        }

        const token = await getAuthToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/data', {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ projectId, updates, _version: currentVersion })
        });

        if (res.status === 409) {
             const errData = await res.json();
             const e: any = new Error("Version Conflict");
             e.code = "CONFLICT";
             e.details = errData;
             throw e;
        }

        if (!res.ok) throw new Error("Patch failed");

        const data = await res.json();
        return data.project;
    },

    deleteAssets: async (urls: string[], projectId: string, explicitToken?: string | null): Promise<void> => {
        if (IS_MOCK_MODE) {
            return; // Nothing to delete on server
        }

        try {
            const token = explicitToken || await getAuthToken();
            await fetch('/api/delete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ urls, projectId })
            });
        } catch (e) {
            console.error("Delete API Error", e);
        }
    },

    comment: async (projectId: string, assetId: string, versionId: string, action: string, payload: any, user: User, explicitToken?: string | null) => {
        if (IS_MOCK_MODE) {
            return; 
        }

        try {
            const token = explicitToken || await getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            await fetch('/api/comment', {
                method: 'POST',
                headers,
                body: JSON.stringify({ projectId, assetId, versionId, action, payload })
            });
        } catch (e) {
            console.error("Comment API Error", e);
        }
    }
};
