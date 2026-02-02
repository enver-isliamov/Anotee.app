
export enum CommentStatus {
  OPEN = 'open',
  RESOLVED = 'resolved'
}

export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface Comment {
  id: string;
  userId: string;
  authorName?: string; 
  timestamp: number; 
  duration?: number; 
  text: string;
  status: CommentStatus;
  createdAt: string;
  replies?: Comment[];
}

export type StorageType = 'vercel' | 'drive' | 'local';

export interface VideoVersion {
  id: string;
  versionNumber: number;
  url: string;
  uploadedAt: string;
  filename: string;
  comments: Comment[];
  isLocked?: boolean; 
  
  storageType?: StorageType; 
  googleDriveId?: string; 

  localFileUrl?: string; 
  localFileName?: string;
}

export interface ProjectAsset {
  id: string;
  title: string;
  thumbnail: string;
  versions: VideoVersion[];
  currentVersionIndex: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  client: string;
  createdAt: number; 
  updatedAt: string;
  assets: ProjectAsset[];
  // Team array is legacy/cached representation. 
  // Real-time access control is handled via Clerk Organizations (orgId).
  team: User[]; 
  ownerId?: string;
  orgId?: string; 
  isLocked?: boolean; 
  publicAccess?: 'view' | 'none'; // New field for link sharing
  _version?: number; // Optimistic locking version
}

export interface UploadTask {
  id: string;
  file: File;
  projectName: string;
  projectId: string; // Ensure projectId is tracked
  targetAssetId?: string; // ID of the asset being updated (if version upload)
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  thumbnail?: string; // New field for optimistic UI
  error?: string;
}
