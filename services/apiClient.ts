
import { Project, User, ProjectAsset, Comment } from '../types';
import { MOCK_PROJECTS } from '../constants';
import { generateId } from './utils';

// Detect environment
const ENV = (import.meta as any).env || {};
const HAS_CLERK_KEY = ENV.VITE_CLERK_PUBLISHABLE_KEY && !ENV.VITE_CLERK_PUBLISHABLE_KEY.includes('placeholder');
const IS_MOCK_MODE = !HAS_CLERK_KEY;

const STORAGE_KEY = 'smotree_projects_data';
const GUEST_TOKEN_KEY = 'smotree_guest_token';

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
    // 1. Try getting Clerk Token first
    if (clerkTokenProvider) {
        try {
            const token = await clerkTokenProvider();
            if (token) return token;
        } catch (e) {
            console.warn("Failed to retrieve Clerk token", e);
        }
    }
    // 2. Fallback to Guest Token
    return localStorage.getItem(GUEST_TOKEN_KEY);
};

export const api = {
    isMockMode: IS_MOCK_MODE,

    // Dependency Injection for Auth
    setTokenProvider: (provider: () => Promise<string | null>) => {
        clerkTokenProvider = provider;
    },

    getProjects: async (user: User | null, explicitToken?: string | null): Promise<Project[]> => {
        if (IS_MOCK_MODE) {
            // Simulate network delay
            await new Promise(r => setTimeout(r, 600));
            return getLocalData();
        }

        if (!user) return [];
        
        try {
            // Use explicit token if provided (fixes race condition), otherwise use provider
            const token = explicitToken || await getAuthToken();
            
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            
            const res = await fetch('/api/data', { headers });
            
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

    joinProject: async (projectId: string, user: User, explicitToken?: string | null): Promise<{ success: boolean, project?: Project }> => {
        if (IS_MOCK_MODE) {
            await new Promise(r => setTimeout(r, 800));
            const projects = getLocalData();
            const project = projects.find(p => p.id === projectId);
            
            if (project) {
                // Add user to team locally if not exists
                if (!project.team.some(u => u.id === user.id)) {
                    project.team.push(user);
                    setLocalData(projects);
                }
                return { success: true, project };
            }
            return { success: false };
        }

        try {
            // Even for joining, we might need auth if available (e.g. to verify the user identity)
            const token = explicitToken || await getAuthToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/join', {
                method: 'POST',
                headers,
                body: JSON.stringify({ projectId, user })
            });
            const data = await res.json();
            return { success: res.ok, project: data.project };
        } catch (e) {
            return { success: false };
        }
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
