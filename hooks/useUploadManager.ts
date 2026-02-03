import { useState, useRef } from 'react';
import { Project, ProjectAsset, UploadTask, StorageType, User } from '../types';
import { generateId, generateVideoThumbnail } from '../services/utils';
import { GoogleDriveService } from '../services/googleDrive';
// Removed: import { upload } from '@vercel/blob/client';
import { api } from '../services/apiClient';
import { useDrive } from '../services/driveContext';

export const useUploadManager = (
    currentUser: User | null,
    projects: Project[],
    setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
    notify: (msg: string, type: 'info' | 'success' | 'error' | 'warning') => void,
    forceSync: (projects: Project[]) => Promise<void>,
    lastLocalUpdateRef: React.MutableRefObject<number>,
    isMockMode: boolean,
    getToken: () => Promise<string | null> 
) => {
    const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
    
    // Throttling Ref to prevent UI freeze
    const lastProgressUpdate = useRef<number>(0);

    const removeUploadTask = (id: string) => {
        setUploadTasks(prev => prev.filter(t => t.id !== id));
    };

    const handleUploadAsset = async (file: File, projectId: string, useDrive: boolean, targetAssetId?: string) => {
        const taskId = generateId();
        
        const newTask: UploadTask = {
            id: taskId,
            file,
            projectName: 'Uploading...', // Placeholder
            progress: 0,
            status: 'uploading'
        };

        setUploadTasks(prev => [...prev, newTask]);

        // Helper to update task state safely
        const updateTask = (updates: Partial<UploadTask>) => {
            setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
        };

        // Helper for throttled progress
        const updateProgress = (percentage: number) => {
            const now = Date.now();
            // Only update every 100ms or if completed to save React renders
            if (percentage === 100 || now - lastProgressUpdate.current > 100) {
                updateTask({ progress: percentage });
                lastProgressUpdate.current = now;
            }
        };

        try {
            // Block server polling to prevent overwriting
            lastLocalUpdateRef.current = Date.now() + 60000; 

            // Find Project & Determine Version Number BEFORE Upload
            const project = projects.find(p => p.id === projectId);
            if (project) updateTask({ projectName: project.name });

            // 1. Calculate Naming & Version
            let nextVersionNumber = 1;
            
            // Extract base name and extension
            // Remove extension
            let rawTitle = file.name.replace(/\.[^/.]+$/, "");
            // Sanitize: Keep alphanumeric, spaces, dashes, underscores. Remove others to prevent FS/URL issues.
            let assetTitle = rawTitle.replace(/[^\w\s\-_]/gi, '');
            if (!assetTitle) assetTitle = "Video_Asset";

            const ext = file.name.split('.').pop();

            if (targetAssetId && project) {
                const existingAsset = project.assets.find(a => a.id === targetAssetId);
                if (existingAsset) {
                    nextVersionNumber = existingAsset.versions.length + 1;
                    // NOTE: We now use the UPLOADED FILE NAME as the base for the new version filename
                    // This allows keeping context like "Cut_v2_ColorGraded" instead of forcing "AssetTitle_v3"
                }
            }

            // Construct Filename: {SanitizedName}_v{Number}.{ext}
            // If it's a fresh upload, it gets _v1. 
            // If it's a version, it gets _vX based on count.
            const finalFileName = `${assetTitle}_v${nextVersionNumber}.${ext}`;

            // 2. Generate Thumbnail
            updateTask({ status: 'processing' });
            const thumbnailDataUrl = await generateVideoThumbnail(file);
            updateTask({ status: 'uploading' });

            let assetUrl = '';
            let googleDriveId = undefined;
            let storageType: StorageType = 'vercel';

            // 3. Upload Process
            if (isMockMode) {
                for (let i = 0; i <= 100; i+=10) {
                    updateProgress(i);
                    await new Promise(r => setTimeout(r, 200));
                }
                assetUrl = URL.createObjectURL(file);
                storageType = 'local';
            } else {
                // FORCE GOOGLE DRIVE UPLOAD
                // We no longer support Vercel Blob uploads for cost reasons.
                const isDriveReady = GoogleDriveService.isAuthenticated();
                if (!isDriveReady) {
                    throw new Error("Google Drive required. Please connect Drive in your Profile settings.");
                }

                const safeProjectName = project ? project.name : "Unknown Project";

                try {
                    const appFolder = await GoogleDriveService.ensureAppFolder();
                    const projectFolder = await GoogleDriveService.ensureFolder(safeProjectName, appFolder);
                    
                    let folderName = assetTitle;
                    if (targetAssetId && project) {
                            const existingAsset = project.assets.find(a => a.id === targetAssetId);
                            if (existingAsset) folderName = existingAsset.title.replace(/[^\w\s\-_]/gi, '');
                    }

                    const assetFolder = await GoogleDriveService.ensureFolder(folderName, projectFolder);

                    const result = await GoogleDriveService.uploadFile(file, assetFolder, (p) => updateProgress(p), finalFileName);
                    googleDriveId = result.id;
                    storageType = 'drive';
                    
                    // CRITICAL: Ensure Permissions are Public immediately after upload
                    // This prevents "Access Denied" when the player tries to load it via 'uc' link
                    await GoogleDriveService.makeFilePublic(result.id);

                } catch (driveErr: any) {
                    if (driveErr.message.includes('401') || driveErr.message.includes('Token')) {
                            throw new Error("Drive Session Expired. Please refresh page/reconnect.");
                    }
                    throw driveErr;
                }
            }

            // 4. Construct New Project State
            // Refetch index to be safe against async state changes
            const projIndex = projects.findIndex(p => p.id === projectId);
            if (projIndex === -1) throw new Error("Project not found during upload finalization");

            const updatedProject = { ...projects[projIndex] };
            
            const newVersion = {
                id: generateId(),
                versionNumber: nextVersionNumber, 
                filename: finalFileName,
                url: assetUrl, // Will be empty for Drive files, Player handles generation via googleDriveId
                storageType,
                googleDriveId,
                uploadedAt: 'Just now',
                comments: [],
                localFileUrl: isMockMode ? URL.createObjectURL(file) : undefined,
                localFileName: isMockMode ? file.name : undefined
            };

            if (targetAssetId) {
                // Adding Version to Existing Asset
                const assetIdx = updatedProject.assets.findIndex(a => a.id === targetAssetId);
                if (assetIdx !== -1) {
                    const asset = { ...updatedProject.assets[assetIdx] };
                    
                    // Add new version
                    asset.versions = [...asset.versions, newVersion];
                    asset.thumbnail = thumbnailDataUrl;
                    asset.currentVersionIndex = asset.versions.length - 1; // Switch to new version
                    updatedProject.assets[assetIdx] = asset;
                }
            } else {
                // New Asset
                const newAsset: ProjectAsset = {
                    id: generateId(),
                    title: assetTitle, // Use the sanitized name as title
                    thumbnail: thumbnailDataUrl,
                    currentVersionIndex: 0,
                    versions: [newVersion]
                };
                updatedProject.assets = [...updatedProject.assets, newAsset];
            }
            
            updatedProject.updatedAt = 'Just now';

            // 5. Try Sync
            try {
                // Optimistically update UI
                setProjects(currentProjects => {
                    const newAllProjects = [...currentProjects];
                    const idx = newAllProjects.findIndex(p => p.id === projectId);
                    if (idx !== -1) newAllProjects[idx] = updatedProject;
                    return newAllProjects;
                });

                // Send to Server
                await forceSync([updatedProject]);
                
                updateTask({ status: 'done', progress: 100 });
                notify("Upload completed", "success");

            } catch (syncError) {
                console.error("Sync failed during upload finalization", syncError);
                setProjects(projects); 
                throw new Error("Failed to save project data. Upload cancelled.");
            }

        } catch (e: any) {
            console.error("Upload failed", e);
            updateTask({ status: 'error', error: e.message || "Upload Failed" });
            notify(`Upload failed: ${e.message}`, "error");
            lastLocalUpdateRef.current = Date.now(); 
        }
    };

    return {
        uploadTasks,
        handleUploadAsset,
        removeUploadTask
    };
};