
import React, { useState, useRef } from 'react';
import { Project, ProjectAsset, UploadTask, StorageType, User } from '../types';
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

    const sanitizeAssetName = (name: string): string => {
        const normalized = name.normalize('NFC').trim();
        const cleaned = normalized
            .replace(/[^\p{L}\p{N}\s._()-]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
        return cleaned || 'Video_Asset';
    };
    
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
            const rawTitle = file.name.replace(/\.[^/.]+$/, "");
            const assetTitle = sanitizeAssetName(rawTitle);

            const extFromName = file.name.split('.').pop()?.trim();
            const ext = extFromName ? extFromName : 'mp4';

            if (targetAssetId && project) {
                const existingAsset = project.assets.find(a => a.id === targetAssetId);
                if (existingAsset) {
                    nextVersionNumber = existingAsset.versions.length + 1;
                }
            }

            // Construct Filename: {SanitizedName}_v{Number}.{ext}
            const finalFileName = `${assetTitle}_v${nextVersionNumber}.${ext}`;

            // 2. Generate Thumbnail
            updateTask({ status: 'processing' });
            const thumbnailDataUrl = await generateVideoThumbnail(file);
            updateTask({ status: 'uploading' });

            let assetUrl = '';
            let googleDriveId = undefined;
            let s3Key = undefined;
            let storageType: StorageType = 'vercel';

            // --- STORAGE SELECTION LOGIC ---
            let useS3 = false;
            
            if (!isMockMode) {
                // Check if user has S3 configured
                // Note: We check config for CURRENT user first, but if uploading to shared project, 
                // the upload will fail if we don't have WRITE access to the owner's bucket.
                // However, the check here is just "should we use S3?".
                // Ideally, we should check if the PROJECT uses S3.
                // For now, let's assume if the current user has S3 set up, they prefer S3.
                // Or better: try to presign with projectId. If backend says "Owner has S3", use it.
                
                try {
                    const token = await getToken();
                    // We check if we can get a presigned URL for this project.
                    // Instead of full config check, we'll try the upload flow immediately below.
                    // But to know *which* flow (Drive vs S3) to pick, we need a hint.
                    // Let's default to S3 attempt first if not Drive-forced.
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
                assetUrl = URL.createObjectURL(file);
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
                                if (existingAsset) folderName = sanitizeAssetName(existingAsset.title);
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

            // 4. Construct New Project State
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
                s3Key, // New Field
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

            // 5. Try Sync
            try {
                setProjects(currentProjects => {
                    const newAllProjects = [...currentProjects];
                    const idx = newAllProjects.findIndex(p => p.id === projectId);
                    if (idx !== -1) newAllProjects[idx] = updatedProject;
                    return newAllProjects;
                });

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
