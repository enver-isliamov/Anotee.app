
export enum CommentStatus {
  OPEN = 'open',
  RESOLVED = 'resolved'
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  email?: string; // Added for admin checks
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
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
}

// --- FEATURE FLAGS & CONFIG ---
export interface FeatureRule {
    enabledForFree: boolean;
    enabledForPro: boolean;
    limitFree?: number; // e.g., 3 projects
    limitPro?: number;  // e.g., 1000 projects
}

export interface AppConfig {
    max_projects: FeatureRule;
    export_xml: FeatureRule;
    export_csv: FeatureRule;
    google_drive: FeatureRule;
    ai_transcription: FeatureRule;
    team_collab: FeatureRule;
}

export const DEFAULT_CONFIG: AppConfig = {
    max_projects: { enabledForFree: true, enabledForPro: true, limitFree: 3, limitPro: 1000 },
    export_xml: { enabledForFree: false, enabledForPro: true },
    export_csv: { enabledForFree: false, enabledForPro: true },
    google_drive: { enabledForFree: false, enabledForPro: true },
    ai_transcription: { enabledForFree: true, enabledForPro: true },
    team_collab: { enabledForFree: true, enabledForPro: true }
};
