
import React, { useState, useRef, useEffect } from 'react';
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
    
    // Worker Ref
    const proxyWorkerRef = useRef<Worker | null>(null);

    useEffect(() => {
        // Initialize Worker
        if (!proxyWorkerRef.current) {
            proxyWorkerRef.current = new Worker(new URL('../services/proxyWorker.ts', import.meta.url), { type: 'module' });
        }
        return () => {
            if (proxyWorkerRef.current) {
                proxyWorkerRef.current.terminate();
                proxyWorkerRef.current = null;
            }
        };
    }, []);
    
    // Throttling Ref to prevent UI freeze
    const lastProgressUpdate = useRef<number>(0);

    const removeUploadTask = (id: string) => {
        setUploadTasks(prev => prev.filter(t => t.id !== id));
    };

    const handleUploadAsset = async (file: File, projectId: string, useDrive: boolean, targetAssetId?: string, createProxy: boolean = false) => {
        const taskId = generateId();
        
        const newTask: UploadTask = {
            id: taskId,
            file,
            projectName: 'Uploading...', // Placeholder
            progress: 0,
            status: createProxy ? 'processing' : 'uploading' // Initial status
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

            // 0. PROXY GENERATION STEP
            let fileToUpload = file;
            
            if (createProxy && proxyWorkerRef.current) {
                notify("Starting background transcoding...", "info");
                
                try {
                    const proxyResult = await new Promise<File>((resolve, reject) => {
                        if (!proxyWorkerRef.current) return reject("Worker not initialized");
                        
                        // Handler for this specific transaction
                        const handler = (e: MessageEvent) => {
                            const { type, file: resultFile, error } = e.data;
                            // In a real app we'd need IDs to match requests, simplifying here assuming serial or isolated usage for MVP
                            if (type === 'done') {
                                proxyWorkerRef.current?.removeEventListener('message', handler);
                                resolve(resultFile);
                            } else if (type === 'error') {
                                proxyWorkerRef.current?.removeEventListener('message', handler);
                                reject(new Error(error));
                            }
                        };

                        proxyWorkerRef.current.addEventListener('message', handler);
                        proxyWorkerRef.current.postMessage({ type: 'transcode', file });
                    });

                    fileToUpload = proxyResult;
                    notify("Proxy created successfully!", "success");
                } catch (proxyError: any) {
                    console.error("Proxy creation failed, uploading original:", proxyError);
                    notify("Proxy failed, uploading original.", "warning");
                    // Fallback to original
                }
            }

            // 1. Calculate Naming & Version
            let nextVersionNumber = 1;
            
            // Extract base name and extension
            let rawTitle = file.name.replace(/\.[^/.]+$/, ""); // Original name for title
            // Sanitize: Keep alphanumeric, spaces, dashes, underscores.
            let assetTitle = rawTitle.replace(/[^\w\s\-_]/gi, '');
            if (!assetTitle) assetTitle = "Video_Asset";

            const ext = fileToUpload.name.split('.').pop(); // Use extension of potentially new file

            if (targetAssetId && project) {
                const existingAsset = project.assets.find(a => a.id === targetAssetId);
                if (existingAsset) {
                    nextVersionNumber = existingAsset.versions.length + 1;
                }
            }

            // Construct Filename: {SanitizedName}_v{Number}.{ext}
            const finalFileName = `${assetTitle}_v${nextVersionNumber}.${ext}`;

            // 2. Generate Thumbnail (From Original or Proxy)
            updateTask({ status: 'processing' });
            const thumbnailDataUrl = await generateVideoThumbnail(fileToUpload);
            updateTask({ status: 'uploading' });

            let assetUrl = '';
            let googleDriveId = undefined;
            let s3Key = undefined;
            let storageType: StorageType = 'vercel';

            // --- STORAGE SELECTION LOGIC ---
            let useS3 = false;
            
            if (!isMockMode) {
                try {
                    // Try to get a token just to ensure we are logged in, 
                    // config check effectively happens when we try to presign below
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
                assetUrl = URL.createObjectURL(fileToUpload);
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
                            contentType: fileToUpload.type,
                            projectId: projectId
                        })
                    });

                    if (presignRes.ok) {
                        const { url: uploadUrl, key } = await presignRes.json();

                        // 2. Upload to S3 directly
                        await new Promise((resolve, reject) => {
                            const xhr = new XMLHttpRequest();
                            xhr.open('PUT', uploadUrl);
                            xhr.setRequestHeader('Content-Type', fileToUpload.type);
                            
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
                            xhr.send(fileToUpload);
                        });

                        storageType = 's3';
                        s3Key = key;
                        s3UploadSuccess = true;
                    } 
                } catch (e) {
                    console.warn("S3 Upload attempt failed, falling back to Drive/Error", e);
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

                        const result = await GoogleDriveService.uploadFile(fileToUpload, assetFolder, (p) => updateProgress(p), finalFileName);
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
                s3Key, 
                uploadedAt: 'Just now',
                comments: [],
                localFileUrl: isMockMode ? URL.createObjectURL(fileToUpload) : undefined,
                localFileName: isMockMode ? fileToUpload.name : undefined
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
                notify(createProxy ? "Proxy uploaded successfully!" : "Upload completed", "success");

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