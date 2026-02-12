
import { useState, useEffect } from 'react';

const DEFAULT_VERSION = 'v1.2602.1';

export const useAppVersion = () => {
    const [version, setVersion] = useState<string>(DEFAULT_VERSION);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVersion = async () => {
            try {
                // Public endpoint, no token needed
                const res = await fetch('/api/admin?action=get_version');
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.version) {
                        setVersion(data.version);
                    }
                }
            } catch (e) {
                console.warn("Failed to fetch app version, using default.", e);
            } finally {
                setLoading(false);
            }
        };

        fetchVersion();
    }, []);

    return { version, loading };
};
