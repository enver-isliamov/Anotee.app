
import { useState, useRef } from 'react';
import { Project, ProjectAsset, UploadTask, StorageType, User } from '../types';
import { generateId, generateVideoThumbnail } from '../services/utils';
import { GoogleDriveService } from '../services/googleDrive';
import { api } from '../services/apiClient';
import { useDrive } from '../services/driveContext';
import { useLanguage } from '../services/i18n';

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
    const { t } = useLanguage();
    
    // Throttling Ref to prevent UI freeze
    const lastProgressUpdate = useRef<number>(0);

    const removeUploadTask = (id: string) => {
        setUploadTasks(prev => prev.filter(t => t.id !== id));
    };

    const handleUploadAsset = async (file: File, projectId: string, useDrive: boolean, targetAssetId?: string) => {
        const taskId = generateId();
        
        // Find Project to get name
        const project = projects.find(p => p.id === projectId);

        // Initial Task State
        const newTask: UploadTask = {
            id: taskId,
            file,
            projectName: project ? project.name : t('common.uploading'),
            projectId: projectId,
            targetAssetId: targetAssetId, // Track if this is a version update
            progress: 0,
            status: 'processing' // Start with processing to generate thumb
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
            // Block server polling
            lastLocalUpdateRef.current = Date.now() + 60000; 

            // 1. Generate Thumbnail IMMEDIATELY for UI feedback
            const thumbnailDataUrl = await generateVideoThumbnail(file);
            updateTask({ 
                thumbnail: thumbnailDataUrl,
                status: 'uploading'
            });

            // 2. Calculate Naming & Version
            let nextVersionNumber = 1;
            
            // Remove extension
            let rawTitle = file.name.replace(/\.[^/.]+$/, "");
            
            // Clean specific version suffixes if present in the uploaded file (e.g. "MyVideo_v2" -> "MyVideo")
            // This prevents "MyVideo_v2_v3.mp4"
            let baseTitle = rawTitle.replace(/_v\d+$/, '');
            
            // Sanitize slightly but keep readability
            let assetTitle = baseTitle; 
            if (!assetTitle) assetTitle = "Video_Asset";

            const ext = file.name.split('.').pop();

            if (targetAssetId && project) {
                const existingAsset = project.assets.find(a => a.id === targetAssetId);
                if (existingAsset) {
                    nextVersionNumber = existingAsset.versions.length + 1;
                    // If adding to existing asset, we might want to stick to the Asset's naming convention
                    // OR allow the new file's name to take precedence. 
                    // Per request: "Save file name". We use the uploaded file's base name.
                    // Actually per SETTINGS.MD: MUST use AssetTitle + index.
                    assetTitle = existingAsset.title; // Override with existing asset title for naming consistency
                }
            } else {
                // Check if an asset with this name already exists to auto-group? 
                // For now, we create new asset.
            }

            // Construct Filename: {BaseName}_v{Number}.{ext}
            const finalFileName = `${assetTitle}_v${nextVersionNumber}.${ext}`;

            let assetUrl = '';
            let googleDriveId = undefined;
            let storageType: StorageType = 'drive';

            // 3. Upload Process
            if (isMockMode) {
                for (let i = 0; i <= 100; i+=10) {
                    updateProgress(i);
                    await new Promise(r => setTimeout(r, 200));
                }
                assetUrl = URL.createObjectURL(file);
                storageType = 'local';
            } else {
                // Google Drive Upload Only
                const isDriveReady = GoogleDriveService.isAuthenticated();
                if (!isDriveReady) {
                    throw new Error("Google Drive token missing. Please reconnect in Profile.");
                }

                const safeProjectName = project ? project.name : "Unknown Project";

                try {
                    const appFolder = await GoogleDriveService.ensureAppFolder();
                    const projectFolder = await GoogleDriveService.ensureFolder(safeProjectName, appFolder);
                    
                    // Decide folder structure. 
                    // If targetAssetId exists, find that asset title for folder.
                    let folderName = assetTitle;
                    if (targetAssetId && project) {
                            const existingAsset = project.assets.find(a => a.id === targetAssetId);
                            if (existingAsset) folderName = existingAsset.title.replace(/[^\w\s\-_]/gi, '');
                    }

                    const assetFolder = await GoogleDriveService.ensureFolder(folderName, projectFolder);

                    const result = await GoogleDriveService.uploadFile(file, assetFolder, (p) => updateProgress(p), finalFileName);
                    googleDriveId = result.id;
                    storageType = 'drive';
                    
                    await GoogleDriveService.makeFilePublic(result.id);
                    // Use standard UC link for URL immediately
                    assetUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${result.id}`;

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
                url: assetUrl,
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
                    title: assetTitle, // Use cleaned name as title
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
                
                // Keep the success task briefly then remove
                updateTask({ status: 'done', progress: 100 });
                setTimeout(() => removeUploadTask(taskId), 2000); // Auto remove after 2s
                
                notify(t('notify.upload_complete'), "success");

            } catch (syncError) {
                console.error("Sync failed during upload finalization", syncError);
                // Rollback not needed for Drive usually as it's separate system, 
                // but local state might be out of sync.
                setProjects(projects); 
                throw new Error("Failed to save project data. Upload cancelled.");
            }

        } catch (e: any) {
            console.error("Upload failed", e);
            updateTask({ status: 'error', error: e.message || "Upload Failed" });
            notify(`${t('notify.upload_fail')}: ${e.message}`, "error");
            lastLocalUpdateRef.current = Date.now(); 
        }
    };

    return {
        uploadTasks,
        handleUploadAsset,
        removeUploadTask
    };
};
