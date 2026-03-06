
import React, { useState, useRef, useEffect } from 'react';
import { Project, ProjectAsset, UploadTask, StorageType, User, VideoVersion } from '../types';
import { generateId, generateVideoThumbnail } from '../services/utils';
import { GoogleDriveService } from '../services/googleDrive';
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

    // Phase XXX: Tab Close Protection
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (uploadTasks.some(t => t.status === 'uploading' || t.status === 'processing')) {
                e.preventDefault();
                e.returnValue = ''; // Standard way to trigger browser warning
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [uploadTasks]);

    const removeUploadTask = (id: string) => {
        setUploadTasks(prev => prev.filter(t => t.id !== id));
    };

    const handleUploadAsset = async (file: File, projectId: string, useDrive: boolean, targetAssetId?: string) => {
        const taskId = generateId();
        const tempAssetId = targetAssetId || generateId();
        const tempVersionId = generateId();
        
        const newTask: UploadTask = {
            id: taskId,
            file,
            projectName: 'Uploading...', // Placeholder
            progress: 0,
            status: 'uploading',
            tempAssetId // Phase XXX: Link task to optimistic asset
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
            let rawTitle = file.name.replace(/\.[^/.]+$/, "");
            // Sanitize: Keep alphanumeric, spaces, dashes, underscores.
            let assetTitle = rawTitle.replace(/[^\w\s\-_]/gi, '');
            if (!assetTitle) assetTitle = "Video_Asset";

            const ext = file.name.split('.').pop();

            if (targetAssetId && project) {
                const existingAsset = project.assets.find(a => a.id === targetAssetId);
                if (existingAsset) {
                    nextVersionNumber = existingAsset.versions.length + 1;
                }
            }

            // Construct Filename: {SanitizedName}_v{Number}.{ext}
            const finalFileName = `${assetTitle}_v${nextVersionNumber}.${ext}`;

            // Phase XXX: Optimistic UI (Zero Latency)
            // Generate local blob URL immediately
            const localBlobUrl = URL.createObjectURL(file);
            
            // Generate thumbnail early for the optimistic UI
            updateTask({ status: 'processing' });
            const thumbnailDataUrl = await generateVideoThumbnail(file);
            updateTask({ status: 'uploading' });

            const optimisticVersion: VideoVersion = {
                id: tempVersionId,
                versionNumber: nextVersionNumber,
                filename: finalFileName,
                url: localBlobUrl, // Use local blob temporarily
                storageType: 'local', // Temporary
                uploadedAt: 'Just now',
                comments: [],
                localFileUrl: localBlobUrl,
                localFileName: file.name
            };

            // Inject optimistic asset into state immediately
            setProjects(currentProjects => {
                const newAllProjects = [...currentProjects];
                const idx = newAllProjects.findIndex(p => p.id === projectId);
                if (idx === -1) return currentProjects;
                
                const updatedProject = { ...newAllProjects[idx] };
                
                if (targetAssetId) {
                    const assetIdx = updatedProject.assets.findIndex(a => a.id === targetAssetId);
                    if (assetIdx !== -1) {
                        const asset = { ...updatedProject.assets[assetIdx] };
                        asset.versions = [...asset.versions, optimisticVersion];
                        asset.thumbnail = thumbnailDataUrl;
                        asset.currentVersionIndex = asset.versions.length - 1;
                        updatedProject.assets[assetIdx] = asset;
                    }
                } else {
                    const newAsset: ProjectAsset = {
                        id: tempAssetId,
                        title: assetTitle,
                        thumbnail: thumbnailDataUrl,
                        currentVersionIndex: 0,
                        versions: [optimisticVersion]
                    };
                    updatedProject.assets = [...updatedProject.assets, newAsset];
                }
                
                newAllProjects[idx] = updatedProject;
                return newAllProjects;
            });

            let assetUrl = '';
            let googleDriveId = undefined;
            let s3Key = undefined;
            let storageType: StorageType = 'vercel';

            // --- STORAGE SELECTION LOGIC ---
            let useS3 = false;
            
            if (!isMockMode) {
                try {
                    const token = await getToken();
                    useS3 = true; 
                } catch (e) {
                    console.warn("Failed to check token");
                }
            }

            // 3. Upload Process
            if (isMockMode) {
                for (let i = 0; i <= 100; i+=10) {
                    updateProgress(i);
                    await new Promise(r => setTimeout(r, 200));
                }
                assetUrl = localBlobUrl;
                storageType = 'local';
            } else if (useS3) {
                let s3UploadSuccess = false;
                try {
                    // --- S3 UPLOAD PATH ---
                    const token = await getToken();
                    // 1. Get Presigned URL (PUT)
                    const presignRes = await fetch('/api/storage?action=presign', {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            operation: 'put',
                            key: `anotee/${projectId}/${finalFileName}`, 
                            contentType: file.type,
                            projectId: projectId // CRITICAL: Upload to Project Owner's Bucket
                        })
                    });

                    if (presignRes.ok) {
                        const { url: uploadUrl, key } = await presignRes.json();

                        // 2. Upload to S3 directly
                        await new Promise((resolve, reject) => {
                            const xhr = new XMLHttpRequest();
                            xhr.open('PUT', uploadUrl);
                            xhr.setRequestHeader('Content-Type', file.type);
                            
                            // Fix for Large Files (50GB+): Prevent browser from aborting long uploads
                            xhr.timeout = 0;

                            xhr.upload.onprogress = (e) => {
                                if (e.lengthComputable) {
                                    updateProgress(Math.round((e.loaded / e.total) * 100));
                                }
                            };

                            xhr.onload = () => {
                                if (xhr.status >= 200 && xhr.status < 300) {
                                    resolve(true);
                                } else {
                                    reject(new Error(`S3 Upload failed: ${xhr.status}`));
                                }
                            };
                            xhr.onerror = () => reject(new Error("Network error during S3 upload"));
                            xhr.send(file);
                        });

                        storageType = 's3';
                        s3Key = key;
                        s3UploadSuccess = true;
                    } 
                } catch (e) {
                    console.warn("S3 Upload attempt failed, falling back to Drive/Error", e);
                    // Fallthrough to Drive if S3 fails (e.g. Owner hasn't configured S3)
                }

                if (!s3UploadSuccess) {
                     // --- GOOGLE DRIVE UPLOAD PATH (Fallback) ---
                    const isDriveReady = GoogleDriveService.isAuthenticated();
                    if (!isDriveReady) {
                        throw new Error("Storage Error: S3 not configured for this project, and Drive not connected.");
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
                        
                        await GoogleDriveService.makeFilePublic(result.id);

                    } catch (driveErr: any) {
                        if (driveErr.message.includes('401') || driveErr.message.includes('Token')) {
                                throw new Error("Drive Session Expired. Please refresh page/reconnect.");
                        }
                        throw driveErr;
                    }
                }

            } 

            // 4. Construct Final Project State (Seamless Swap)
            let finalProjectToSync: Project | null = null;
            
            setProjects(currentProjects => {
                const newAllProjects = [...currentProjects];
                const idx = newAllProjects.findIndex(p => p.id === projectId);
                if (idx === -1) return currentProjects;
                
                const updatedProject = { ...newAllProjects[idx] };
                
                const assetIdx = updatedProject.assets.findIndex(a => a.id === tempAssetId);
                if (assetIdx !== -1) {
                    const asset = { ...updatedProject.assets[assetIdx] };
                    const versionIdx = asset.versions.findIndex(v => v.id === tempVersionId);
                    
                    if (versionIdx !== -1) {
                        // Replace optimistic properties with real cloud properties
                        asset.versions[versionIdx] = {
                            ...asset.versions[versionIdx],
                            url: assetUrl,
                            storageType,
                            googleDriveId,
                            s3Key
                        };
                    }
                    updatedProject.assets[assetIdx] = asset;
                }
                
                updatedProject.updatedAt = 'Just now';
                newAllProjects[idx] = updatedProject;
                finalProjectToSync = updatedProject;
                return newAllProjects;
            });

            // 5. Try Sync
            if (finalProjectToSync) {
                try {
                    await forceSync([finalProjectToSync]);
                    
                    updateTask({ status: 'done', progress: 100 });
                    notify("Upload completed", "success");

                } catch (syncError) {
                    console.error("Sync failed during upload finalization", syncError);
                    throw new Error("Failed to save project data. Upload cancelled.");
                }
            }

        } catch (e: any) {
            console.error("Upload failed", e);
            updateTask({ status: 'error', error: e.message || "Upload Failed" });
            notify(`Upload failed: ${e.message}`, "error");
            
            // Revert optimistic UI on failure
            setProjects(currentProjects => {
                const newAllProjects = [...currentProjects];
                const idx = newAllProjects.findIndex(p => p.id === projectId);
                if (idx === -1) return currentProjects;
                
                const updatedProject = { ...newAllProjects[idx] };
                
                if (targetAssetId) {
                    // Remove the failed version
                    const assetIdx = updatedProject.assets.findIndex(a => a.id === targetAssetId);
                    if (assetIdx !== -1) {
                        const asset = { ...updatedProject.assets[assetIdx] };
                        asset.versions = asset.versions.filter(v => v.id !== tempVersionId);
                        asset.currentVersionIndex = Math.max(0, asset.versions.length - 1);
                        updatedProject.assets[assetIdx] = asset;
                    }
                } else {
                    // Remove the whole failed asset
                    updatedProject.assets = updatedProject.assets.filter(a => a.id !== tempAssetId);
                }
                
                newAllProjects[idx] = updatedProject;
                return newAllProjects;
            });
            
            lastLocalUpdateRef.current = Date.now(); 
        }
    };

    return {
        uploadTasks,
        handleUploadAsset,
        removeUploadTask
    };
};
