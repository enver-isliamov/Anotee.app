
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GoogleDriveService } from './googleDrive';
import { useAuth } from '@clerk/clerk-react';

interface DriveContextType {
    isDriveReady: boolean;
    checkDriveConnection: () => Promise<void>;
}

const DriveContext = createContext<DriveContextType | undefined>(undefined);

export const DriveProvider: React.FC<{ children: React.ReactNode, isMockMode: boolean }> = ({ children, isMockMode }) => {
    const [isDriveReady, setIsDriveReady] = useState(false);
    const { isSignedIn } = useAuth();

    const checkDriveConnection = useCallback(async () => {
        if (isMockMode || !isSignedIn) {
            setIsDriveReady(false);
            return;
        }
        
        // Try to get token. Service is already configured in App.tsx with provider
        const token = await GoogleDriveService.getToken();
        setIsDriveReady(!!token);
    }, [isMockMode, isSignedIn]);

    // Initial Check
    useEffect(() => {
        checkDriveConnection();
    }, [checkDriveConnection]);

    return (
        <DriveContext.Provider value={{ isDriveReady, checkDriveConnection }}>
            {children}
        </DriveContext.Provider>
    );
};

export const useDrive = () => {
    const context = useContext(DriveContext);
    if (!context) {
        throw new Error("useDrive must be used within a DriveProvider");
    }
    return context;
};
