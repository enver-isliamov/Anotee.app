
import { useState, useRef } from 'react';
import { Project, ProjectAsset, UploadTask, StorageType, User } from '../types';
import { generateId, generateVideoThumbnail } from '../services/utils';
import { GoogleDriveService } from '../services/googleDrive';
import { upload } from '@vercel/blob/client';
import { api } from '../services/apiClient';

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

        const updateTask = (updates: Partial<UploadTask>) => {
            setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
        };

        try {
            // Block server polling to prevent overwriting
            lastLocalUpdateRef.current = Date.now() + 60000; 

            // 1. Generate Thumbnail
            updateTask({ status: 'processing' });
            const thumbnailDataUrl = await generateVideoThumbnail(file);
            const assetTitle = file.name.replace(/\.[^/.]+$/, "");
            
            // Find Project Name for UI
            const project = projects.find(p => p.id === projectId);
            if (project) updateTask({ projectName: project.name });

            updateTask({ status: 'uploading' });

            let assetUrl = '';
            let googleDriveId = undefined;
            let storageType: StorageType = 'vercel';
            let finalFileName = file.name;

            // 2. Upload Process
            if (isMockMode) {
                for (let i = 0; i <= 100; i+=10) {
                    updateTask({ progress: i });
                    await new Promise(r => setTimeout(r, 200));
                }
                assetUrl = URL.createObjectURL(file);
                storageType = 'local';
            } else {
                if (useDrive) {
                    const isDriveReady = GoogleDriveService.isAuthenticated();
                    if (!isDriveReady) throw new Error("Google Drive not connected");

                    const safeProjectName = project ? project.name : "Unknown Project";

                    const appFolder = await GoogleDriveService.ensureAppFolder();
                    const projectFolder = await GoogleDriveService.ensureFolder(safeProjectName, appFolder);
                    const assetFolder = await GoogleDriveService.ensureFolder(assetTitle, projectFolder);

                    const ext = file.name.split('.').pop();
                    const niceName = targetAssetId 
                          ? `${assetTitle}_vNEW.${ext}`
                          : `${assetTitle}_v1.${ext}`;

                    const result = await GoogleDriveService.uploadFile(file, assetFolder, (p) => updateTask({ progress: p }), niceName);
                    googleDriveId = result.id;
                    storageType = 'drive';
                    finalFileName = niceName;
                } else {
                    // Vercel Blob
                    const token = await getToken();
                    if (!token) throw new Error("Authentication missing for upload");

                    const newBlob = await upload(file.name, file, {
                        access: 'public',
                        handleUploadUrl: '/api/upload',
                        clientPayload: JSON.stringify({ 
                            token: token, 
                            projectId: projectId 
                        }),
                        onUploadProgress: (p) => updateTask({ progress: Math.round((p.loaded / p.total) * 100) })
                    });
                    assetUrl = newBlob.url;
                }
            }

            // 3. Construct New Project State
            // We calculate the new state but don't set it yet to allow rollback logic
            const projIndex = projects.findIndex(p => p.id === projectId);
            if (projIndex === -1) throw new Error("Project not found during upload finalization");

            const updatedProject = { ...projects[projIndex] };
            
            const newVersion = {
                id: generateId(),
                versionNumber: 1, 
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
                // Adding Version
                const assetIdx = updatedProject.assets.findIndex(a => a.id === targetAssetId);
                if (assetIdx !== -1) {
                    const asset = { ...updatedProject.assets[assetIdx] };
                    newVersion.versionNumber = asset.versions.length + 1;
                    
                    if (!isMockMode && useDrive) {
                        newVersion.filename = `${asset.title}_v${newVersion.versionNumber}.${file.name.split('.').pop()}`;
                    }
                    
                    asset.versions = [...asset.versions, newVersion];
                    asset.thumbnail = thumbnailDataUrl;
                    asset.currentVersionIndex = asset.versions.length - 1;
                    updatedProject.assets[assetIdx] = asset;
                }
            } else {
                // New Asset
                const newAsset: ProjectAsset = {
                    id: generateId(),
                    title: assetTitle,
                    thumbnail: thumbnailDataUrl,
                    currentVersionIndex: 0,
                    versions: [newVersion]
                };
                updatedProject.assets = [...updatedProject.assets, newAsset];
            }
            
            updatedProject.updatedAt = 'Just now';

            // 4. Try Sync
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
                
                // Rollback Blob if sync failed (to avoid orphans)
                if (!isMockMode && storageType === 'vercel' && assetUrl) {
                    try {
                        console.log("Rolling back orphaned blob:", assetUrl);
                        await api.deleteAssets([assetUrl], projectId);
                    } catch(delErr) {
                        console.error("Failed to rollback blob", delErr);
                    }
                }
                
                // Revert UI State (Reload from server ideally, but basic revert here)
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
