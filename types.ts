
export enum UserRole {
  ADMIN = 'Admin',
  CREATOR = 'Creator',
  GUEST = 'Guest'
}

export enum CommentStatus {
  OPEN = 'open',
  RESOLVED = 'resolved'
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
}

export interface Comment {
  id: string;
  userId: string;
  authorName?: string; // New: Persist name to handle removed users
  timestamp: number; // in seconds (Start time)
  duration?: number; // Optional duration in seconds
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
  isLocked?: boolean; // Prevents new comments
  
  // Storage Info
  storageType?: StorageType; 
  googleDriveId?: string; // If storageType is 'drive'

  // Temporary fields for local session playback
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
  createdAt: number; // Timestamp for 7-day expiration logic
  updatedAt: string;
  assets: ProjectAsset[];
  team: User[];
  ownerId?: string;
  isLocked?: boolean; // Project-level lock
}