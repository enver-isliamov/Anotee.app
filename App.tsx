
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProjectView } from './components/ProjectView';
import { Player } from './components/Player';
import { Login } from './components/Login';
import { Profile } from './components/Profile';
import { AdminPanel } from './components/AdminPanel';
import { TestRunner } from './components/TestRunner'; // Import the new component
import { WorkflowPage, AboutPage, PricingPage, AiFeaturesPage } from './components/StaticPages';
import { LegalPage } from './components/LegalPages';
import { LiveDemo } from './components/LiveDemo';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { Project, ProjectAsset, User, StorageType, UploadTask } from './types';
import { generateId } from './services/utils';
import { LanguageProvider, LanguageCloudSync } from './services/i18n';
import { ThemeProvider, ThemeCloudSync } from './services/theme';
import { MainLayout } from './components/MainLayout';
import { GoogleDriveService } from './services/googleDrive';
import { useUser, useClerk, useAuth, ClerkProvider, useOrganization } from '@clerk/clerk-react';
import { api } from './services/apiClient';
import { Loader2, UploadCloud, X, CheckCircle, AlertCircle, RefreshCw, PartyPopper, WifiOff, Shield } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShortcutsModal } from './components/ShortcutsModal';
import { useUploadManager } from './hooks/useUploadManager';
import { DriveProvider, useDrive } from './services/driveContext';
import { OnboardingWidget } from './components/OnboardingWidget';
import useSWR, { mutate } from 'swr';

type ViewState = 
  | { type: 'DASHBOARD' }
  | { type: 'PROJECT_VIEW', projectId: string, restrictedAssetId?: string }
  | { type: 'PLAYER', assetId: string, projectId: string, restrictedAssetId?: string }
  | { type: 'PROFILE' }
  | { type: 'ADMIN' }
  | { type: 'WORKFLOW' }
  | { type: 'ABOUT' }
  | { type: 'PRICING' }
  | { type: 'AI_FEATURES' }
  | { type: 'TERMS' }
  | { type: 'PRIVACY' }
  | { type: 'LIVE_DEMO' }
  | { type: 'TEST_RUNNER' }; // New Route

// --- GLOBAL UPLOAD WIDGET COMPONENT ---
const UploadWidget: React.FC<{ tasks: UploadTask[], onClose: (id: string) => void }> = ({ tasks, onClose }) => {
    if (tasks.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[100] w-80 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-300">
            <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                    <UploadCloud size={14} /> Uploads ({tasks.length})
                </span>
            </div>
            <div className="max-h-60 overflow-y-auto">
                {tasks.map(task => (
                    <div key={task.id} className="p-3 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0 relative">
                        <div className="flex justify-between items-start mb-1">
                            <div className="truncate pr-4">
                                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate" title={task.file.name}>{task.file.name}</div>
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">in {task.projectName}</div>
                            </div>
                            <div className="shrink-0">
                                {task.status === 'done' && <CheckCircle size={14} className="text-green-500" />}
                                {task.status === 'error' && <AlertCircle size={14} className="text-red-500" />}
                                {task.status === 'uploading' && <span className="text-[10px] font-mono font-bold text-indigo-500">{task.progress}%</span>}
                                {(task.status === 'done' || task.status === 'error') && (
                                    <button onClick={() => onClose(task.id)} className="ml-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                        {task.status === 'uploading' && (
                            <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1 mt-1 overflow-hidden">
                                <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${task.progress}%` }}></div>
                            </div>
                        )}
                        {task.status === 'processing' && (
                            <div className="flex items-center gap-1 text-[10px] text-indigo-500 mt-1">
                                <Loader2 size={10} className="animate-spin" /> Processing...
                            </div>
                        )}
                        {task.status === 'error' && <div className="text-[10px] text-red-500 mt-1">{task.error}</div>}
                    </div>
                ))}
            </div>
        </div>
    );
};

interface TourStep {
    id: string;
    title: string;
    desc: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

// --- TOUR CONFIGURATION ---
const TOUR_STEPS: Record<string, TourStep[]> = {
    DASHBOARD: [
        { id: 'tour-create-btn', title: '1. Создание проекта', desc: 'Начните с создания нового проекта. Здесь вы будете хранить и организовывать видео.' },
        { id: 'tour-shared-section', title: '2. Чужие проекты', desc: 'Здесь появятся проекты, к которым вам дали доступ другие пользователи или ваша команда.', position: 'top' },
        { id: 'tour-profile-btn', title: '3. Настройки и Оплата', desc: 'Управляйте подпиской, подключайте Google Drive и меняйте язык здесь.', position: 'left' }
    ],
    PROJECT_VIEW: [
        { id: 'tour-upload-zone', title: '1. Загрузка видео', desc: 'Просто перетащите файл в эту зону. Мы автоматически создадим легкие прокси для быстрого просмотра.' },
        { id: 'tour-context-badge', title: '2. Рабочее пространство', desc: 'Этот бейдж показывает владельца проекта: "Personal" (ваш личный) или "Organization" (общий для команды).', position: 'bottom' },
        { id: 'tour-assets-grid', title: '3. Ваши файлы', desc: 'Здесь отображаются все загруженные видео. Кликните, чтобы открыть плеер.' },
        { id: 'tour-share-btn', title: '4. Команда и Приглашения', desc: 'Нажмите на плюсик (+), чтобы добавить участников в команду или отправить публичную ссылку клиенту.' }
    ],
    PLAYER: [
        { id: 'tour-version-selector', title: '1. Версии файла', desc: 'Загрузили новую версию монтажа? Переключайтесь между v1, v2, v3 здесь. История сохраняется.', position: 'bottom' },
        { id: 'tour-timecode', title: '2. Точность кадров', desc: 'Мы считаем кадры, а не секунды. Нажмите здесь, чтобы сменить формат (FPS).', position: 'bottom' },
        { id: 'tour-comment-input', title: '3. Комментарии', desc: 'Оставляйте правки. Они привязываются к текущему кадру. Нажмите Enter для отправки.', position: 'top' },
        { id: 'tour-sidebar-tabs', title: '4. Инструменты', desc: 'Переключайтесь между списком правок и AI-транскрипцией речи.', position: 'right' },
        { id: 'tour-export-btn', title: '5. Экспорт в монтажку', desc: 'Killer-feature: скачайте XML или CSV и импортируйте маркеры прямо в DaVinci Resolve или Premiere.', position: 'left' }
    ]
};

interface AppLayoutProps {
    clerkUser: any | null;
    isLoaded: boolean;
    isSignedIn: boolean;
    getToken: () => Promise<string | null>;
    signOut: () => Promise<void>;
    mockSignIn?: () => void;
    authMode: 'clerk' | 'mock';
    organization?: any;
    userObj?: any;
}

const AppLayout: React.FC<AppLayoutProps> = ({ clerkUser, isLoaded, isSignedIn, getToken, signOut, mockSignIn, authMode, organization, userObj }) => {
  const isMockMode = authMode === 'mock';
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<ViewState>({ type: 'DASHBOARD' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  const [showTimeoutMsg, setShowTimeoutMsg] = useState(false);

  // Onboarding Visibility State
  const [hideOnboarding, setHideOnboarding] = useState(() => {
      return localStorage.getItem('anotee_hide_tour') === 'true';
  });

  // Manual Tour State
  const [isManualTourActive, setIsManualTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Modal State for Create Project
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);

  // Use Drive Context
  const { checkDriveConnection } = useDrive();

  // Track the last local modification to prevent server overwrites
  const lastLocalUpdateRef = useRef<number>(0);
  
  // SWR Key Generation
  const getKey = () => {
      if (!currentUser) return null;
      const params = new URLSearchParams(window.location.search);
      const directProjectId = params.get('projectId');
      const directAssetId = params.get('assetId'); // Added AssetID to key
      return ['/api/data', currentUser.id, organization?.id, directProjectId || '', directAssetId || ''];
  };

  // SWR Fetcher
  const fetcher = async () => {
      const params = new URLSearchParams(window.location.search);
      const directProjectId = params.get('projectId');
      const directAssetId = params.get('assetId'); // Pass to API
      return await api.getProjects(currentUser, null, organization?.id, directProjectId || undefined, directAssetId || undefined);
  };

  const pollingInterval = view.type === 'PLAYER' ? 15000 : 0;

  const { data: serverProjects, mutate: mutateProjects } = useSWR(getKey, fetcher, {
      refreshInterval: pollingInterval, 
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      keepPreviousData: true
  });

  // Sync SWR Data to Local State (Preserving Blob URLs)
  useEffect(() => {
      if (serverProjects && Array.isArray(serverProjects)) {
          if (Date.now() - lastLocalUpdateRef.current < 2000) return;

          setProjects(currentLocalProjects => {
              const prevHash = currentLocalProjects.map(p => `${p.id}:${p._version || 0}`).sort().join('|');
              const newHash = serverProjects.map(p => `${p.id}:${p._version || 0}`).sort().join('|');
              
              if (prevHash === newHash && currentLocalProjects.length === serverProjects.length) {
                  return currentLocalProjects;
              }

              const mergedProjects = serverProjects.map(serverProj => {
                  const localProj = currentLocalProjects.find(p => p.id === serverProj.id);
                  if (localProj) {
                      const mergedAssets = serverProj.assets.map(serverAsset => {
                          const localAsset = localProj.assets.find(a => a.id === serverAsset.id);
                          if (!localAsset) return serverAsset;
                          const mergedVersions = serverAsset.versions.map(serverVer => {
                              const localVer = localAsset.versions.find(v => v.id === serverVer.id);
                              if (localVer && localVer.localFileUrl) {
                                  if (!isMockMode && localVer.localFileUrl.startsWith('blob:')) {
                                      return { ...serverVer, localFileUrl: localVer.localFileUrl, localFileName: localVer.localFileName };
                                  }
                              }
                              return serverVer;
                          });
                          return { ...serverAsset, versions: mergedVersions };
                      });
                      return { ...serverProj, assets: mergedAssets };
                  }
                  return serverProj;
              });
              return mergedProjects;
          });
          setIsSyncing(false);
      }
  }, [serverProjects, isMockMode]);


  const notify = (message: string, type: ToastType = 'info') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    let timer: any;
    if (!isLoaded) {
      timer = setTimeout(() => setShowTimeoutMsg(true), 8000); 
    } else {
      setShowTimeoutMsg(false);
    }
    return () => clearTimeout(timer);
  }, [isLoaded]);

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get('payment');
      if (paymentStatus === 'success') {
          notify("Payment Successful! Welcome to Founder's Club.", "success");
          if (userObj && userObj.reload) {
              userObj.reload().then(() => {
                  mutateProjects(); 
                  setView({ type: 'PROFILE' });
              });
          }
      } else if (paymentStatus === 'canceled' || paymentStatus === 'failed') {
          notify("Payment was canceled or failed.", "error");
      }
      if (paymentStatus) {
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
      }
  }, [userObj, mutateProjects]);

  useEffect(() => {
    const handlePopState = () => {
        const params = new URLSearchParams(window.location.search);
        const pId = params.get('projectId');
        const aId = params.get('assetId');
        const path = window.location.pathname;

        if (path === '/panel' || path === '/admin') {
            setView({ type: 'ADMIN' });
        } else if (path === '/terms') {
            setView({ type: 'TERMS' });
        } else if (path === '/privacy') {
            setView({ type: 'PRIVACY' });
        } else if (path === '/pricing') {
            setView({ type: 'PRICING' });
        } else if (path === '/about') {
            setView({ type: 'ABOUT' });
        } else if (path === '/workflow') {
            setView({ type: 'WORKFLOW' });
        } else if (path === '/ai') {
            setView({ type: 'AI_FEATURES' });
        } else if (path === '/profile') {
            setView({ type: 'PROFILE' });
        } else if (path === '/demo') {
            setView({ type: 'LIVE_DEMO' });
        } else if (path === '/test') { // Handle TEST URL
            setView({ type: 'TEST_RUNNER' });
        } else if (pId && aId) {
            setView({ type: 'PLAYER', projectId: pId, assetId: aId, restrictedAssetId: aId }); 
        } else if (pId) {
            setView({ type: 'PROJECT_VIEW', projectId: pId });
        } else {
            setView({ type: 'DASHBOARD' });
        }
    };
    handlePopState();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ... (Shortcuts and other logic remains same) ...
  useEffect(() => {
      const handleGlobalDrag = (e: DragEvent) => e.preventDefault();
      const handleGlobalKeys = (e: KeyboardEvent) => {
          if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) && !(e.target as HTMLElement).isContentEditable) {
              e.preventDefault();
              setShowShortcuts(prev => !prev);
          }
      };
      window.addEventListener('dragover', handleGlobalDrag);
      window.addEventListener('drop', handleGlobalDrag);
      window.addEventListener('keydown', handleGlobalKeys);
      return () => {
          window.removeEventListener('dragover', handleGlobalDrag);
          window.removeEventListener('drop', handleGlobalDrag);
          window.removeEventListener('keydown', handleGlobalKeys);
      };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn && clerkUser) {
        const meta = clerkUser.publicMetadata as any;
        const role = meta?.role;
        setCurrentUser({
            id: clerkUser.id,
            name: clerkUser.fullName || clerkUser.firstName || 'User',
            avatar: clerkUser.imageUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev',
            email: clerkUser.primaryEmailAddress?.emailAddress,
            isAdmin: role === 'admin' || role === 'superadmin'
        });
    } else {
        setCurrentUser(null);
    }
  }, [isLoaded, isSignedIn, clerkUser]);

  useEffect(() => {
    api.setTokenProvider(getToken);
    if (isSignedIn && !isMockMode) {
        GoogleDriveService.setTokenProvider(async () => {
            try {
                const clerkToken = await getToken();
                if (!clerkToken) return null;
                const res = await fetch('/api/driveToken', { headers: { 'Authorization': `Bearer ${clerkToken}` } });
                if (res.ok) {
                    const data = await res.json();
                    checkDriveConnection();
                    return data.token; 
                } else {
                    return null;
                }
            } catch (e) {
                return null;
            }
        });
    } else {
        GoogleDriveService.setTokenProvider(async () => null);
    }
  }, [isSignedIn, getToken, isMockMode, checkDriveConnection]);

  const handleLogout = async () => {
    if (isSignedIn) await signOut();
    setView({ type: 'DASHBOARD' });
    window.history.pushState({}, '', '/');
  };

  const forceSync = async (projectsData: Project[]) => {
      // ... (Same sync logic) ...
      if (!currentUser) return;
      lastLocalUpdateRef.current = Date.now();
      let token: string | null = null;
      if (authMode === 'clerk') try { token = await getToken(); } catch(e) {}
      try {
          setIsSyncing(true);
          const updates = await api.syncProjects(projectsData, currentUser, token);
          if (updates && updates.length > 0) {
              setProjects(current => current.map(p => {
                  const update = updates.find((u: any) => u.id === p.id);
                  return update ? { ...p, _version: update._version } : p;
              }));
              mutateProjects();
          }
      } catch (e: any) {
          if (e.code === 'CONFLICT') {
              notify("Conflict detected. Reloading...", "warning");
              lastLocalUpdateRef.current = 0; 
              mutateProjects(); 
          } else {
              notify("Failed to save changes. Check internet.", "error");
          }
      } finally {
          setIsSyncing(false);
      }
  };

  const { uploadTasks, handleUploadAsset, removeUploadTask } = useUploadManager(
      currentUser, projects, setProjects, notify, forceSync, lastLocalUpdateRef, isMockMode, getToken 
  );

  const handleSelectProject = (project: Project) => {
    setView({ type: 'PROJECT_VIEW', projectId: project.id });
    const newUrl = `/?projectId=${project.id}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleSelectAsset = (asset: ProjectAsset) => {
    if (view.type === 'PROJECT_VIEW') {
      setView({ type: 'PLAYER', assetId: asset.id, projectId: view.projectId, restrictedAssetId: view.restrictedAssetId });
      const newUrl = `/?projectId=${view.projectId}&assetId=${asset.id}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  };

  const handleBackToDashboard = () => {
    setView({ type: 'DASHBOARD' });
    window.history.pushState({}, '', '/');
  };

  const handleBackToProject = () => {
    if (view.type === 'PLAYER') {
      setView({ type: 'PROJECT_VIEW', projectId: view.projectId, restrictedAssetId: view.restrictedAssetId });
      const newUrl = `/?projectId=${view.projectId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  };

  const handleUpdateProject = (updatedProject: Project, skipSync = false) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    if (!skipSync) forceSync([updatedProject]);
  };
  
  const handleEditProject = (projectId: string, data: Partial<Project>) => {
      const updated = projects.map(p => p.id === projectId ? { ...p, ...data, updatedAt: 'Just now' } : p);
      setProjects(updated);
      const targetProject = updated.find(p => p.id === projectId);
      if (targetProject) forceSync([targetProject]);
      notify("Project updated", "success");
  };

  const handleAddProject = (newProject: Project) => {
    const projectWithVersion = { ...newProject, _version: 0 };
    const newProjects = [projectWithVersion, ...projects];
    setProjects(newProjects);
    notify("Project created successfully", "success");
    forceSync([projectWithVersion]);
  };

  const handleDeleteProject = async (projectId: string) => {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      notify("Project deleted", "info");
      if ((view.type === 'PROJECT_VIEW' || view.type === 'PLAYER') && view.projectId === projectId) {
          handleBackToDashboard();
      }
  };
  
  const handleNavigate = (page: string) => {
      let path = '/';
      switch(page) {
          case 'WORKFLOW': path = '/workflow'; break;
          case 'ABOUT': path = '/about'; break;
          case 'PRICING': path = '/pricing'; break;
          case 'PROFILE': path = '/profile'; break;
          case 'ADMIN': path = '/admin'; break; 
          case 'AI_FEATURES': path = '/ai'; break;
          case 'LIVE_DEMO': path = '/demo'; break;
          case 'DASHBOARD': path = '/'; break;
          case 'TERMS': path = '/terms'; break;
          case 'PRIVACY': path = '/privacy'; break;
          case 'TEST_RUNNER': path = '/test'; break; // New path handling
      }
      
      window.history.pushState({}, '', path);

      switch(page) {
          case 'WORKFLOW': setView({ type: 'WORKFLOW' }); break;
          case 'ABOUT': setView({ type: 'ABOUT' }); break;
          case 'PRICING': setView({ type: 'PRICING' }); break;
          case 'PROFILE': setView({ type: 'PROFILE' }); break;
          case 'ADMIN': setView({ type: 'ADMIN' }); break; 
          case 'AI_FEATURES': setView({ type: 'AI_FEATURES' }); break;
          case 'LIVE_DEMO': setView({ type: 'LIVE_DEMO' }); break;
          case 'DASHBOARD': setView({ type: 'DASHBOARD' }); break;
          case 'TERMS': setView({ type: 'TERMS' }); break;
          case 'PRIVACY': setView({ type: 'PRIVACY' }); break;
          case 'TEST_RUNNER': setView({ type: 'TEST_RUNNER' }); break;
          default: setView({ type: 'DASHBOARD' });
      }
  };

  // ... (Tour Logic unchanged) ...
  const activeOrgId = organization?.id;
  const myProjects = projects.filter(p => {
      if (activeOrgId) return p.orgId === activeOrgId;
      return !p.orgId && (p.ownerId === currentUser?.id || p.team?.some(m => m.id === currentUser?.id));
  });

  const hasProjects = myProjects.length > 0;
  const currentProject = (view.type === 'PROJECT_VIEW' || view.type === 'PLAYER') ? projects.find(p => p.id === view.projectId) : null;
  const hasAssets = currentProject ? currentProject.assets.length > 0 : false;
  const hasComments = currentProject ? currentProject.assets.some(a => a.versions.some(v => v.comments.length > 0)) : false;

  const handleDismissTour = () => {
      setHideOnboarding(true);
      localStorage.setItem('anotee_hide_tour', 'true');
      setIsManualTourActive(false);
      setTourStep(0);
  };

  const handleStartTour = () => {
      setIsManualTourActive(true);
      setTourStep(0);
  };

  // Calculate active tour step
  let tourTargetId = '';
  let tourTitle = '';
  let tourDesc = '';
  let tourTotalSteps = 1;
  let tourCurrentStep = 1;
  let tourPosition: 'top' | 'bottom' | 'left' | 'right' | undefined = 'bottom';

  // Manual Tour Logic (Overrides Smart Logic)
  if (isManualTourActive && view.type !== 'LIVE_DEMO') {
      const config = TOUR_STEPS[view.type as keyof typeof TOUR_STEPS] || [];
      if (config.length > 0 && tourStep < config.length) {
          const step = config[tourStep];
          tourTargetId = step.id;
          tourTitle = step.title;
          tourDesc = step.desc;
          tourPosition = step.position || 'bottom';
          tourTotalSteps = config.length;
          tourCurrentStep = tourStep + 1;
      } else {
          // Tour finished
          setIsManualTourActive(false);
          setTourStep(0);
      }
  } 
  // Smart Logic (Only if Manual is inactive and user hasn't dismissed hints)
  else if (!hideOnboarding && view.type !== 'LIVE_DEMO') {
      if (view.type === 'DASHBOARD' && !hasProjects) {
          tourTargetId = 'tour-create-btn';
          tourTitle = '1. Создайте проект';
          tourDesc = 'Начните работу с создания нового пространства.';
      } else if (view.type === 'PROJECT_VIEW' && currentProject && !hasAssets) {
          tourTargetId = 'tour-upload-zone';
          tourTitle = '2. Загрузите видео';
          tourDesc = 'Добавьте видеофайл. Мы создадим прокси для быстрой работы.';
      } else if (view.type === 'PLAYER' && currentProject && !hasComments) {
          tourTargetId = 'tour-comment-input';
          tourTitle = '3. Оставьте комментарий';
          tourDesc = 'Напишите таймкод-комментарий или используйте голосовой ввод.';
      } else if (hasProjects && hasAssets && hasComments && view.type === 'PROJECT_VIEW') {
          tourTargetId = 'tour-share-btn';
          tourTitle = '4. Пригласите команду';
          tourDesc = 'Отправьте ссылку клиенту или коллегам для ревью.';
      }
  }

  const handleNextStep = () => {
      if (isManualTourActive) {
          const config = TOUR_STEPS[view.type as keyof typeof TOUR_STEPS] || [];
          if (tourStep < config.length - 1) {
              setTourStep(prev => prev + 1);
          } else {
              setIsManualTourActive(false);
              setTourStep(0);
          }
      } else {
          handleDismissTour();
      }
  };

  const handlePrevStep = () => {
      if (isManualTourActive && tourStep > 0) {
          setTourStep(prev => prev - 1);
      }
  };

  if (!isLoaded) return (
        <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
            <Loader2 size={48} className="text-indigo-500 animate-spin mb-6" />
            {showTimeoutMsg && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-sm bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-2xl">
                    <div className="flex justify-center mb-4">
                        <div className="p-3 bg-red-500/10 rounded-full text-red-500">
                            <WifiOff size={24} />
                        </div>
                    </div>
                    <h3 className="text-white font-bold mb-2">Медленное соединение</h3>
                    <p className="text-zinc-400 text-xs mb-4 leading-relaxed">
                        Загрузка занимает дольше обычного. Это часто случается из-за замедления трафика провайдером.
                    </p>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-left">
                        <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Рекомендация:</p>
                        <p className="text-zinc-300 text-xs flex items-center gap-2">
                            <Shield size={12} className="text-indigo-500" />
                            Попробуйте включить <strong>VPN</strong>
                        </p>
                    </div>
                </div>
            )}
        </div>
  );

  if (view.type === 'LIVE_DEMO') return <LiveDemo onBack={() => handleNavigate('DASHBOARD')} />;
  if (view.type === 'TEST_RUNNER') return <TestRunner onBack={() => handleNavigate('DASHBOARD')} />; // New Render

  const currentAsset = (view.type === 'PLAYER' && currentProject) ? currentProject.assets.find(a => a.id === view.assetId) : null;

  if (!currentUser) {
      if (['WORKFLOW', 'ABOUT', 'PRICING', 'AI_FEATURES', 'TERMS', 'PRIVACY'].includes(view.type)) {
          return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
                <MainLayout currentUser={null} currentView={view.type} onNavigate={handleNavigate} onBack={handleBackToDashboard}>
                    {view.type === 'WORKFLOW' && <WorkflowPage />}
                    {view.type === 'ABOUT' && <AboutPage />}
                    {view.type === 'PRICING' && <PricingPage />}
                    {view.type === 'AI_FEATURES' && <AiFeaturesPage />}
                    {view.type === 'TERMS' && <LegalPage type="TERMS" />}
                    {view.type === 'PRIVACY' && <LegalPage type="PRIVACY" />}
                </MainLayout>
                <ToastContainer toasts={toasts} removeToast={removeToast} />
            </div>
          );
      }
      return <><Login onLogin={() => {}} onNavigate={handleNavigate} />{isMockMode && <div className="fixed bottom-0 w-full bg-yellow-500 text-black text-center text-xs font-bold">PREVIEW MODE</div>}</>;
  }

  if (view.type === 'ADMIN') return <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"><AdminPanel onBack={handleBackToDashboard} onNavigate={handleNavigate} /></div>;

  const isPlatformView = ['DASHBOARD', 'PROFILE', 'WORKFLOW', 'ABOUT', 'PRICING', 'AI_FEATURES', 'TERMS', 'PRIVACY'].includes(view.type);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <main className="h-full">
        {isPlatformView && (
            <MainLayout 
                currentUser={currentUser} 
                currentView={view.type} 
                onNavigate={handleNavigate} 
                onBack={handleBackToDashboard}
                onStartTour={handleStartTour}
            >
                {view.type === 'DASHBOARD' && (
                <Dashboard 
                    projects={projects} 
                    currentUser={currentUser}
                    onSelectProject={handleSelectProject}
                    onAddProject={handleAddProject}
                    onDeleteProject={handleDeleteProject}
                    onEditProject={handleEditProject}
                    onNavigate={handleNavigate}
                    notify={notify}
                    isMockMode={isMockMode}
                    isCreateModalOpen={isCreateModalOpen}
                    setCreateModalOpen={setCreateModalOpen}
                />
                )}
                {view.type === 'PROFILE' && <Profile currentUser={currentUser} onLogout={handleLogout} onNavigate={handleNavigate} />}
                {view.type === 'WORKFLOW' && <WorkflowPage />}
                {view.type === 'ABOUT' && <AboutPage />}
                {view.type === 'PRICING' && <PricingPage />}
                {view.type === 'AI_FEATURES' && <AiFeaturesPage />}
                {view.type === 'TERMS' && <LegalPage type="TERMS" />}
                {view.type === 'PRIVACY' && <LegalPage type="PRIVACY" />}
            </MainLayout>
        )}

        {view.type === 'PROJECT_VIEW' && currentProject && (
          <ErrorBoundary>
            <ProjectView 
                project={currentProject} 
                currentUser={currentUser}
                onBack={handleBackToDashboard}
                onSelectAsset={handleSelectAsset}
                onUpdateProject={handleUpdateProject}
                notify={notify}
                restrictedAssetId={view.restrictedAssetId}
                isMockMode={isMockMode}
                onUploadAsset={handleUploadAsset} 
                uploadTasks={uploadTasks} 
                onStartTour={handleStartTour} // PASSED PROP
            />
          </ErrorBoundary>
        )}
        {view.type === 'PLAYER' && currentProject && currentAsset && (
          <ErrorBoundary>
            <Player 
                asset={currentAsset} 
                project={currentProject}
                currentUser={currentUser}
                onBack={handleBackToProject}
                users={currentProject.team}
                onUpdateProject={(p, skipSync) => handleUpdateProject(p, skipSync)}
                isSyncing={isSyncing}
                notify={notify}
                isMockMode={isMockMode}
            />
          </ErrorBoundary>
        )}
        
        {view.type !== 'PROJECT_VIEW' && (
            <UploadWidget tasks={uploadTasks} onClose={removeUploadTask} />
        )}
        
        {tourTargetId && (
            <OnboardingWidget 
                targetId={tourTargetId}
                title={tourTitle}
                description={tourDesc}
                onDismiss={handleDismissTour}
                onNext={isManualTourActive ? handleNextStep : undefined}
                onPrev={isManualTourActive ? handlePrevStep : undefined}
                currentStep={tourCurrentStep}
                totalSteps={tourTotalSteps}
                position={tourPosition}
            />
        )}

        <ToastContainer toasts={toasts} removeToast={removeToast} />
        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
        {isMockMode && <div className="fixed bottom-0 w-full bg-yellow-500/90 text-black text-center text-xs font-bold pointer-events-none z-[100]">PREVIEW MODE</div>}
      </main>
    </div>
  );
};

const AuthWrapper: React.FC = () => {
    const { user, isLoaded, isSignedIn } = useUser();
    const { getToken, signOut } = useAuth();
    const { organization } = useOrganization();
    return <AppLayout clerkUser={user} isLoaded={isLoaded} isSignedIn={!!isSignedIn} getToken={getToken} signOut={signOut} authMode="clerk" organization={organization} userObj={user} />;
};

const App: React.FC = () => {
    const env = (import.meta as any).env || {};
    const clerkPubKey = env.VITE_CLERK_PUBLISHABLE_KEY;
    const isMockMode = !clerkPubKey || clerkPubKey.includes('placeholder');

    if (isMockMode) {
        return <ErrorBoundary><LanguageProvider><ThemeProvider><DriveProvider isMockMode={true}><AppLayout clerkUser={{ id: 'mock-user', fullName: 'Mock User', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mock', primaryEmailAddress: { emailAddress: 'mock@example.com' } }} isLoaded={true} isSignedIn={true} getToken={async () => 'mock-token'} signOut={async () => window.location.reload()} mockSignIn={() => {}} authMode="mock" /></DriveProvider></ThemeProvider></LanguageProvider></ErrorBoundary>;
    }
    return <ErrorBoundary><ClerkProvider publishableKey={clerkPubKey}><LanguageProvider><ThemeProvider><LanguageCloudSync /><ThemeCloudSync /><DriveProvider isMockMode={false}><AuthWrapper /></DriveProvider></ThemeProvider></LanguageProvider></ClerkProvider></ErrorBoundary>;
};

export default App;
