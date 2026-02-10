
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
    // Core Features
    max_projects: FeatureRule;
    export_xml: FeatureRule;
    export_csv: FeatureRule;
    google_drive: FeatureRule;
    ai_transcription: FeatureRule;
    team_collab: FeatureRule;
    local_file_link: FeatureRule;
    high_res_proxies: FeatureRule;
    project_locking: FeatureRule;
    version_comparison: FeatureRule;

    // UI Control Flags
    ui_upsell_banner: FeatureRule;
    ui_roadmap_block: FeatureRule;
    ui_help_button: FeatureRule;
    ui_footer: FeatureRule;
    ui_drive_connect: FeatureRule;
}

export const DEFAULT_CONFIG: AppConfig = {
    // Core Features
    max_projects: { enabledForFree: true, enabledForPro: true, limitFree: 3, limitPro: 1000 },
    export_xml: { enabledForFree: false, enabledForPro: true },
    export_csv: { enabledForFree: false, enabledForPro: true },
    google_drive: { enabledForFree: false, enabledForPro: true },
    ai_transcription: { enabledForFree: true, enabledForPro: true },
    team_collab: { enabledForFree: true, enabledForPro: true },
    local_file_link: { enabledForFree: true, enabledForPro: true },
    high_res_proxies: { enabledForFree: false, enabledForPro: true },
    project_locking: { enabledForFree: false, enabledForPro: true },
    version_comparison: { enabledForFree: true, enabledForPro: true },

    // UI Defaults
    ui_upsell_banner: { enabledForFree: true, enabledForPro: false }, // Hide upsell for Pro users by default
    ui_roadmap_block: { enabledForFree: true, enabledForPro: false },
    ui_help_button: { enabledForFree: true, enabledForPro: true },
    ui_footer: { enabledForFree: true, enabledForPro: true },
    ui_drive_connect: { enabledForFree: false, enabledForPro: true }, // Drive UI hidden for free by default
};

// --- PAYMENT INTEGRATION CONFIG ---

export interface PlanConfig {
    id: 'monthly' | 'lifetime' | 'team';
    isActive: boolean; // If false -> Shows as "Phase X / Locked"
    title: string;
    price: number;
    currency: string;
    features: string[];
    phaseLabel?: string; // e.g. "Phase 3"
}

export interface PaymentConfig {
    activeProvider: 'yookassa' | 'prodamus';
    // Legacy simple prices (kept for backward compat in API)
    prices: {
        lifetime: number;
        monthly: number;
    };
    // Rich plan configuration
    plans: {
        monthly: PlanConfig;
        lifetime: PlanConfig;
        team: PlanConfig;
    };
    yookassa: {
        shopId: string;
        secretKey: string;
    };
    prodamus: {
        url: string; // e.g. https://demo.payform.ru
        secretKey: string;
    };
}

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
    activeProvider: 'prodamus',
    prices: {
        lifetime: 4900,
        monthly: 490
    },
    plans: {
        monthly: {
            id: 'monthly',
            isActive: true,
            title: 'Pro Subscription',
            price: 490,
            currency: '₽',
            features: ['Unlimited Projects', 'Export (XML, CSV)', '4K Support'],
            phaseLabel: 'Phase 2'
        },
        lifetime: {
            id: 'lifetime',
            isActive: true,
            title: "Founder's Club",
            price: 4900,
            currency: '₽',
            features: ['Lifetime License', 'One-time payment', 'Priority Support', 'Early Access Features'],
            phaseLabel: 'Phase 1'
        },
        team: {
            id: 'team',
            isActive: false,
            title: 'Team Plan',
            price: 0,
            currency: '₽',
            features: ['Multiple Seats', 'SSO & Audit Logs', 'Team Drives'],
            phaseLabel: 'Phase 3'
        }
    },
    yookassa: { shopId: '', secretKey: '' },
    prodamus: { url: '', secretKey: '' }
};
