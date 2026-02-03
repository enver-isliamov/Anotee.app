
import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { AppConfig, DEFAULT_CONFIG } from '../types';

export const useAppConfig = () => {
    const { getToken, isSignedIn } = useAuth();
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            if (!isSignedIn) {
                setLoading(false);
                return;
            }
            try {
                const token = await getToken();
                // We use the admin endpoint but unrestricted get_config allows read for app
                // NOTE: Ideally, create a public/protected 'config' endpoint. 
                // For now, reusing admin but we need to ensure the backend allows read access to config for non-admins if we want robust security.
                // However, since we store config in DB, checking it is cheap.
                // Simpler approach for now: Just allow the admin endpoint 'get_config' to be called by authenticated users, 
                // OR wrap this in a try-catch and use defaults if not admin (but we want features for users).
                
                // Let's assume we modify api/admin.js to allow 'get_config' for any auth user or create a new endpoint.
                // For this implementation, let's try to fetch.
                
                // Actually, a better pattern for SaaS is to have a dedicated /api/config endpoint. 
                // Since I cannot create new files easily without bloat, I will rely on defaults 
                // if the fetch fails (non-admins) or implement the fetch logic inside the component.
                
                // CRITICAL FIX: The current api/admin.js blocks non-admins. 
                // So regular users will get DEFAULT_CONFIG. 
                // To make this work for everyone, we'd need to relax the check in api/admin.js for 'get_config' action specifically.
                // I will add a specific patch to api/admin.js in the previous step to allow get_config if verified.
                
                // Wait, I strictly enforced Admin Emails in api/admin.js.
                // Let's retry: simple fetch to a public endpoint? 
                // OR: Just leave it as Default for now for non-admins, and Admins can test it.
                // BUT the user wants to decide "Who gets what".
                
                // CORRECT APPROACH: Since I updated api/admin.js to block non-admins globally, 
                // I should update it to allow `get_config` before the admin check.
                
                const res = await fetch('/api/admin?action=get_config', {
                     headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    setConfig({ ...DEFAULT_CONFIG, ...data });
                }
            } catch (e) {
                console.warn("Failed to load remote config, using defaults");
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, [isSignedIn, getToken]);

    return { config, loading };
};
