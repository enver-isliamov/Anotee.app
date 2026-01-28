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

export const api = {
    isMockMode: IS_MOCK_MODE,

    getProjects: async (user: User | null): Promise<Project[]> => {
        if (IS_MOCK_MODE) {
            // Simulate network delay
            await new Promise(r => setTimeout(r, 600));
            return getLocalData();
        }

        if (!user) return [];
        
        // Real API Call
        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            else headers['X-Guest-ID'] = user.id;

            const res = await fetch('/api/data', { headers });
            if (!res.ok) throw new Error(res.statusText);
            return await res.json();
        } catch (e) {
            console.error("API Get Error", e);
            throw e;
        }
    },

    syncProjects: async (projects: Project[], user: User | null): Promise<void> => {
        if (IS_MOCK_MODE) {
            setLocalData(projects);
            return;
        }

        if (!user) return;

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            else headers['X-Guest-ID'] = user.id;

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

            await fetch('/api/data', {
                method: 'POST',
                headers,
                body: JSON.stringify(cleanData)
            });
        } catch (e) {
            console.error("API Sync Error", e);
        }
    },

    joinProject: async (projectId: string, user: User): Promise<{ success: boolean, project?: Project }> => {
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
            const res = await fetch('/api/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, user })
            });
            const data = await res.json();
            return { success: res.ok, project: data.project };
        } catch (e) {
            return { success: false };
        }
    },

    deleteAssets: async (urls: string[]): Promise<void> => {
        if (IS_MOCK_MODE) {
            return; // Nothing to delete on server
        }

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            await fetch('/api/delete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ urls })
            });
        } catch (e) {
            console.error("Delete API Error", e);
        }
    },

    comment: async (projectId: string, assetId: string, versionId: string, action: string, payload: any, user: User) => {
        if (IS_MOCK_MODE) {
            // Comments are handled via syncProjects in App.tsx state, 
            // but if we moved logic here, we would update localStorage.
            // For now, Player.tsx handles state update and calls syncProjects via onUpdateProject
            return; 
        }

        try {
            const token = await (window as any).Clerk?.session?.getToken();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            else headers['X-Guest-ID'] = user.id;

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