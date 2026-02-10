
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
    google_drive: { enabledForFree: false, enabledForPro: true }, // Logic handled in components, allowing drive for all but UI controlled
    ai_transcription: { enabledForFree: true, enabledForPro: true },
    team_collab: { enabledForFree: false, enabledForPro: true }, // Default: Block sharing for Free
    local_file_link: { enabledForFree: true, enabledForPro: true },
    high_res_proxies: { enabledForFree: false, enabledForPro: true },
    project_locking: { enabledForFree: false, enabledForPro: true },
    version_comparison: { enabledForFree: true, enabledForPro: true },

    // UI Defaults
    ui_upsell_banner: { enabledForFree: true, enabledForPro: false }, // Hide upsell for Pro users by default
    ui_roadmap_block: { enabledForFree: true, enabledForPro: false },
    ui_help_button: { enabledForFree: true, enabledForPro: true },
    ui_footer: { enabledForFree: true, enabledForPro: true },
    ui_drive_connect: { enabledForFree: true, enabledForPro: true }, // Enabled for free to allow upload
};

// --- PAYMENT INTEGRATION CONFIG ---

export interface PlanFeature {
    title: string;
    desc: string;
    isCore: boolean;
}

export interface PlanConfig {
    id: 'free' | 'monthly' | 'lifetime' | 'team';
    isActive: boolean; // If false -> Shows as "Phase X / Locked"
    title: string;
    subtitle?: string;
    price: number;
    currency: string;
    features: PlanFeature[];
    phaseLabel?: string; // e.g. "Phase 3"
    footerStatus?: string; // e.g. "Открыто"
    footerLimit?: string; // e.g. "Первые 150 пользователей"
}

export interface PaymentConfig {
    activeProvider: 'yookassa' | 'prodamus';
    // Legacy simple prices (kept for backward compat in API)
    prices: {
        lifetime: number;
        monthly: number;
    };
    // Order of plans on the frontend
    planOrder: string[]; 
    // Rich plan configuration
    plans: {
        free: PlanConfig; // New Free Plan
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
    activeProvider: 'yookassa',
    prices: {
        lifetime: 2900,
        monthly: 490
    },
    planOrder: ['free', 'monthly', 'lifetime', 'team'],
    plans: {
        free: {
            id: 'free',
            isActive: true,
            title: 'Starter',
            subtitle: 'Для личного использования',
            price: 0,
            currency: '₽',
            features: [
                { title: 'До 3-х проектов', desc: 'Лимит активных проектов.', isCore: true },
                { title: '720p Прокси', desc: 'Базовое качество стриминга.', isCore: false },
                { title: 'Google Drive', desc: 'Прямая интеграция.', isCore: false },
                { title: 'Комментарии', desc: 'Базовые инструменты ревью.', isCore: false }
            ],
            phaseLabel: 'Базовый',
            footerStatus: 'Всегда доступно',
            footerLimit: 'Без ограничений'
        },
        monthly: {
            id: 'monthly',
            isActive: false,
            title: 'Pro Subscription',
            subtitle: 'Для тех, кто хочет платить помесячно',
            price: 490,
            currency: '₽',
            features: [
                { title: 'Полный доступ', desc: 'Все функции платформы включены.', isCore: false },
                { title: 'Ежемесячная оплата', desc: 'Отмена в любой момент.', isCore: false }
            ],
            phaseLabel: 'Фаза 2 (Закрыто)',
            footerStatus: 'Скоро',
            footerLimit: 'После 500 пользователей'
        },
        lifetime: {
            id: 'lifetime',
            isActive: true,
            title: "Founder's Club",
            subtitle: "Платите один раз. Пользуйтесь вечно. Никаких подписок.",
            price: 2900,
            currency: '₽',
            features: [
                { title: 'Пожизненная лицензия', desc: 'Anotee V1.X навсегда.', isCore: true },
                { title: 'Протокол Flash-Loom', desc: 'Мгновенная синхронизация комментариев и видео.', isCore: true },
                { title: 'Безлимитный доступ', desc: 'Нет ограничений на количество проектов для основателей.', isCore: false },
                { title: 'Экспорт в NLE', desc: 'DaVinci Resolve (XML), Premiere (CSV), EDL.', isCore: false }
            ],
            phaseLabel: 'Фаза 1 (Открыто)',
            footerStatus: 'Открыто',
            footerLimit: 'Первые 150 пользователей'
        },
        team: {
            id: 'team',
            isActive: false,
            title: 'Team Plan',
            subtitle: 'Для студий и продакшенов',
            price: 0,
            currency: '₽',
            features: [
                { title: 'Несколько мест', desc: 'Управление доступом сотрудников.', isCore: false },
                { title: 'Общие диски', desc: 'Централизованное хранилище.', isCore: false }
            ],
            phaseLabel: 'Фаза 3 (Закрыто)',
            footerStatus: 'В разработке',
            footerLimit: 'Конец 2025'
        }
    },
    yookassa: { shopId: '', secretKey: '' },
    prodamus: { url: '', secretKey: '' }
};
