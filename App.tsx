import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProjectView } from './components/ProjectView';
import { Player } from './components/Player';
import { Login } from './components/Login';
import { Profile } from './components/Profile';
import { AdminPanel } from './components/AdminPanel'; // Import new component
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
import { Loader2, UploadCloud, X, CheckCircle, AlertCircle, RefreshCw, PartyPopper } from 'lucide-react';
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
  | { type: 'ADMIN' } // NEW VIEW STATE
  | { type: 'WORKFLOW' }
  | { type: 'ABOUT' }
  | { type: 'PRICING' }
  | { type: 'AI_FEATURES' }
  | { type: 'TERMS' }
  | { type: 'PRIVACY' }
  | { type: 'LIVE_DEMO' };

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
  
  // Timeout State for Diagnostics
  const [showTimeoutMsg, setShowTimeoutMsg] = useState(false);

  // Onboarding Visibility State
  const [hideOnboarding, setHideOnboarding] = useState(() => {
      return localStorage.getItem('anotee_hide_onboarding') === 'true';
  });

  // Modal State for Create Project (Lifted from Dashboard)
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);

  // Use Drive Context
  const { checkDriveConnection } = useDrive();

  // Track the last local modification to prevent server overwrites
  const lastLocalUpdateRef = useRef<number>(0);
  
  // SWR Key Generation
  const getKey = () => {
      if (!currentUser) return null;
      // Direct Link Check
      const params = new URLSearchParams(window.location.search);
      const directProjectId = params.get('projectId');
      
      return ['/api/data', currentUser.id, organization?.id, directProjectId || ''];
  };

  // SWR Fetcher
  const fetcher = async () => {
      const params = new URLSearchParams(window.location.search);
      const directProjectId = params.get('projectId');
      
      // Pass token implicitly via api client logic or get it fresh
      // Using explicit token getter in api client handles refresh
      return await api.getProjects(currentUser, null, organization?.id, directProjectId || undefined);
  };

  // --- DATA FETCHING (SWR) ---
  const { data: serverProjects, mutate: mutateProjects } = useSWR(getKey, fetcher, {
      refreshInterval: 20000, // Poll every 20s (optimized)
      revalidateOnFocus: true, // Refresh when user comes back
      dedupingInterval: 5000,
      keepPreviousData: true
  });

  // Sync SWR Data to Local State (Preserving Blob URLs)
  useEffect(() => {
      if (serverProjects && Array.isArray(serverProjects)) {
          // If we just modified data locally, skip this sync cycle to prevent jumping
          if (Date.now() - lastLocalUpdateRef.current < 2000) return;

          setProjects(currentLocalProjects => {
              // Optimization: Compare hashes to avoid re-render if data is identical
              const prevHash = currentLocalProjects.map(p => `${p.id}:${p._version || 0}`).sort().join('|');
              const newHash = serverProjects.map(p => `${p.id}:${p._version || 0}`).sort().join('|');
              
              if (prevHash === newHash && currentLocalProjects.length === serverProjects.length) {
                  return currentLocalProjects;
              }

              // Merge logic: Preserve localFileUrl (Blob URLs) which are not on server
              const mergedProjects = serverProjects.map(serverProj => {
                  const localProj = currentLocalProjects.find(p => p.id === serverProj.id);
                  
                  if (localProj) {
                      const mergedAssets = serverProj.assets.map(serverAsset => {
                          const localAsset = localProj.assets.find(a => a.id === serverAsset.id);
                          if (!localAsset) return serverAsset;

                          const mergedVersions = serverAsset.versions.map(serverVer => {
                              const localVer = localAsset.versions.find(v => v.id === serverVer.id);
                              if (localVer && localVer.localFileUrl) {
                                  // Keep local blob URL if valid
                                  if (!isMockMode && localVer.localFileUrl.startsWith('blob:')) {
                                      return {
                                          ...serverVer,
                                          localFileUrl: localVer.localFileUrl,
                                          localFileName: localVer.localFileName
                                      };
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

  // --- LOADING TIMEOUT HANDLER ---
  useEffect(() => {
    let timer: any;
    if (!isLoaded) {
      timer = setTimeout(() => setShowTimeoutMsg(true), 8000); // 8 seconds timeout
    } else {
      setShowTimeoutMsg(false);
    }
    return () => clearTimeout(timer);
  }, [isLoaded]);

  // --- PAYMENT STATUS HANDLER ---
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get('payment');
      
      if (paymentStatus === 'success') {
          notify("Payment Successful! Welcome to Founder's Club.", "success");
          if (userObj && userObj.reload) {
              userObj.reload().then(() => {
                  console.log("User metadata refreshed");
                  mutateProjects(); // Refresh SWR
                  setView({ type: 'PROFILE' });
              });
          }
      } else if (paymentStatus === 'canceled' || paymentStatus === 'failed') {
          notify("Payment was canceled or failed.", "error");
      }

      if (paymentStatus) {
          // Clean URL
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
      }
  }, [userObj, mutateProjects]);

  // --- NAVIGATION HANDLER (HISTORY API) ---
  useEffect(() => {
    const handlePopState = () => {
        const params = new URLSearchParams(window.location.search);
        const pId = params.get('projectId');
        const aId = params.get('assetId');
        const path = window.location.pathname;

        if (path === '/panel' || path === '/admin') {
            setView({ type: 'ADMIN' });
        } else if (pId && aId) {
            setView({ type: 'PLAYER', projectId: pId, assetId: aId });
        } else if (pId) {
            setView({ type: 'PROJECT_VIEW', projectId: pId });
        } else {
            setView({ type: 'DASHBOARD' });
        }
    };

    // Initial Load Check
    handlePopState();

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  // --- PREVENT BROWSER DEFAULT DRAG DROP & GLOBAL SHORTCUTS ---
  useEffect(() => {
      const handleGlobalDrag = (e: DragEvent) => {
          e.preventDefault();
      };
      
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

  // --- SYNC AUTH STATE ---
  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && clerkUser) {
        setCurrentUser({
            id: clerkUser.id,
            name: clerkUser.fullName || clerkUser.firstName || 'User',
            avatar: clerkUser.imageUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev',
            email: clerkUser.primaryEmailAddress?.emailAddress
        });
    } else {
        setCurrentUser(null);
    }
  }, [isLoaded, isSignedIn, clerkUser]);

  // --- CONFIGURE API & DRIVE SERVICES ---
  useEffect(() => {
    api.setTokenProvider(getToken);

    if (isSignedIn && !isMockMode) {
        GoogleDriveService.setTokenProvider(async () => {
            try {
                const clerkToken = await getToken();
                if (!clerkToken) return null;
                
                const res = await fetch('/api/driveToken', {
                    headers: { 'Authorization': `Bearer ${clerkToken}` }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    checkDriveConnection();
                    return data.token; 
                } else {
                    return null;
                }
            } catch (e) {
                console.error("Token fetch error", e);
                return null;
            }
        });
    } else {
        GoogleDriveService.setTokenProvider(async () => null);
    }
  }, [isSignedIn, getToken, isMockMode, checkDriveConnection]);

  const handleLogout = async () => {
    if (isSignedIn) {
        await signOut();
    } 
    setView({ type: 'DASHBOARD' });
    window.history.pushState({}, '', '/');
  };

  const forceSync = async (projectsData: Project[]) => {
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
                  if (update) {
                      return { ...p, _version: update._version };
                  }
                  return p;
              }));
              // Trigger SWR revalidation silently to ensure consistency
              mutateProjects();
          }
      } catch (e: any) {
          console.error("Sync failed", e);
          if (e.code === 'CONFLICT') {
              notify("Conflict detected. Reloading...", "warning");
              lastLocalUpdateRef.current = 0; 
              mutateProjects(); // Fetch server state immediately
          } else {
              notify("Failed to save changes. Check internet.", "error");
          }
      } finally {
          setIsSyncing(false);
      }
  };

  const { uploadTasks, handleUploadAsset, removeUploadTask } = useUploadManager(
      currentUser,
      projects,
      setProjects,
      notify,
      forceSync,
      lastLocalUpdateRef,
      isMockMode,
      getToken 
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
    if (!skipSync) {
        forceSync([updatedProject]);
    }
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
      window.history.pushState({}, '', '/');
      switch(page) {
          case 'WORKFLOW': setView({ type: 'WORKFLOW' }); break;
          case 'ABOUT': setView({ type: 'ABOUT' }); break;
          case 'PRICING': setView({ type: 'PRICING' }); break;
          case 'PROFILE': setView({ type: 'PROFILE' }); break;
          case 'ADMIN': setView({ type: 'ADMIN' }); break; // Handle Admin nav
          case 'AI_FEATURES': setView({ type: 'AI_FEATURES' }); break;
          case 'LIVE_DEMO': setView({ type: 'LIVE_DEMO' }); break;
          case 'DASHBOARD': setView({ type: 'DASHBOARD' }); break;
          case 'TERMS': setView({ type: 'TERMS' }); break;
          case 'PRIVACY': setView({ type: 'PRIVACY' }); break;
          default: setView({ type: 'DASHBOARD' });
      }
  };

  // Helper to jump to the most relevant project for next step
  const handleGoToLatestProject = () => {
      // Find visible projects for current user/org
      const activeOrgId = organization?.id;
      const visible = projects.filter(p => {
          if (activeOrgId) return p.orgId === activeOrgId;
          return !p.orgId && (p.ownerId === currentUser?.id || p.team?.some(m => m.id === currentUser?.id));
      });

      if (visible.length > 0) {
          const sorted = [...visible].sort((a, b) => b.createdAt - a.createdAt);
          handleSelectProject(sorted[0]);
      }
  };

  const handleDismissOnboarding = () => {
      setHideOnboarding(true);
      localStorage.setItem('anotee_hide_onboarding', 'true');
  };

  if (!isLoaded) {
      return (
          <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
              <Loader2 size={32} className="text-indigo-500 animate-spin mb-4" />
              {showTimeoutMsg && (
                  <div className="max-w-md bg-zinc-900 border border-zinc-800 p-6 rounded-xl animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
                      <div className="flex items-center gap-2 mb-2 text-white">
                          <AlertCircle size={20} className="text-orange-500" />
                          <h3 className="font-bold">Taking longer than expected...</h3>
                      </div>
                      <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                          The app is having trouble connecting to the authentication server. 
                          This is common during new domain setup.
                      </p>
                      <div className="bg-black/30 p-3 rounded-lg mb-4">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase mb-2">Likely Causes:</p>
                          <ul className="text-left text-zinc-400 text-xs space-y-1.5 list-disc pl-4">
                              <li>DNS (CNAME) records for <code>clerk.yourdomain.com</code> have not propagated yet.</li>
                              <li>The Clerk <strong>Publishable Key</strong> in Vercel settings is incorrect or missing.</li>
                              <li>Ad-blockers or privacy extensions are blocking Clerk scripts.</li>
                              <li><strong>HTTP/3 (QUIC)</strong> blocking by your ISP (check logs).</li>
                          </ul>
                      </div>
                      <button onClick={() => window.location.reload()} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2">
                          <RefreshCw size={14} /> Reload Page
                      </button>
                  </div>
              )}
          </div>
      );
  }

  if (view.type === 'LIVE_DEMO') {
      return <LiveDemo onBack={() => handleNavigate('DASHBOARD')} />;
  }

  const currentProject = (view.type === 'PROJECT_VIEW' || view.type === 'PLAYER') ? projects.find(p => p.id === view.projectId) : null;
  const currentAsset = (view.type === 'PLAYER' && currentProject) ? currentProject.assets.find(a => a.id === view.assetId) : null;

  if (!currentUser) {
      const isPublicView = ['WORKFLOW', 'ABOUT', 'PRICING', 'AI_FEATURES', 'TERMS', 'PRIVACY'].includes(view.type);
      if (isPublicView) {
          return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
                <MainLayout 
                    currentUser={null} 
                    currentView={view.type} 
                    onNavigate={handleNavigate}
                    onBack={handleBackToDashboard}
                >
                    {view.type === 'WORKFLOW' && <WorkflowPage />}
                    {view.type === 'ABOUT' && <AboutPage />}
                    {view.type === 'PRICING' && <PricingPage />}
                    {view.type === 'AI_FEATURES' && <AiFeaturesPage />}
                    {view.type === 'TERMS' && <LegalPage type="TERMS" />}
                    {view.type === 'PRIVACY' && <LegalPage type="PRIVACY" />}
                </MainLayout>
                <ToastContainer toasts={toasts} removeToast={removeToast} />
                {isMockMode && (
                    <div className="fixed bottom-0 left-0 right-0 bg-yellow-500/90 text-center text-xs font-bold py-1 z-[100] backdrop-blur-sm text-black">
                        PREVIEW MODE: No Backend (Data saved to LocalStorage)
                    </div>
                )}
            </div>
          );
      }
      return (
        <>
            <Login 
                onLogin={() => {}} 
                onNavigate={handleNavigate} 
            />
            {isMockMode && (
                <div className="fixed bottom-0 left-0 right-0 bg-yellow-500/90 text-black text-center text-xs font-bold py-1 z-[100]">
                    PREVIEW MODE: Login to test
                </div>
            )}
        </>
      );
  }

  // Admin Panel Render
  if (view.type === 'ADMIN') {
      return (
          <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
              <AdminPanel onBack={handleBackToDashboard} />
          </div>
      );
  }

  const isPlatformView = ['DASHBOARD', 'PROFILE', 'WORKFLOW', 'ABOUT', 'PRICING', 'AI_FEATURES', 'TERMS', 'PRIVACY'].includes(view.type);

  // Filter projects for onboarding context (current org)
  const activeOrgId = organization?.id;
  const onboardingProjects = projects.filter(p => {
      if (activeOrgId) return p.orgId === activeOrgId;
      return !p.orgId && (p.ownerId === currentUser?.id || p.team?.some(m => m.id === currentUser?.id));
  });

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      <main className="h-full">
        {isPlatformView && (
            <MainLayout 
                currentUser={currentUser} 
                currentView={view.type} 
                onNavigate={handleNavigate}
                onBack={handleBackToDashboard}
            >
                {/* Onboarding Widget: Full Mode on Dashboard */}
                {view.type === 'DASHBOARD' && (
                    <OnboardingWidget 
                        projects={onboardingProjects}
                        variant="full"
                        onDismiss={handleDismissOnboarding}
                        hide={hideOnboarding}
                        onCreateProject={() => setCreateModalOpen(true)}
                        onGoToProject={handleGoToLatestProject}
                        onInvite={handleGoToLatestProject}
                    />
                )}

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
                {view.type === 'PROFILE' && (
                    <Profile 
                        currentUser={currentUser}
                        onLogout={handleLogout}
                        onNavigate={handleNavigate} // Pass navigation prop
                    />
                )}
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
        
        {/* GLOBAL COMPONENTS */}
        <UploadWidget tasks={uploadTasks} onClose={removeUploadTask} />
        
        {/* Persistent Onboarding: Compact Mode on other pages */}
        {view.type !== 'DASHBOARD' && (
             <OnboardingWidget 
                projects={onboardingProjects}
                variant="compact"
                onDismiss={handleDismissOnboarding}
                hide={hideOnboarding}
                onCreateProject={() => {
                    handleBackToDashboard(); // Go to dash first
                    setTimeout(() => setCreateModalOpen(true), 100);
                }}
                onGoToProject={handleGoToLatestProject}
                onInvite={handleGoToLatestProject}
            />
        )}

        <ToastContainer toasts={toasts} removeToast={removeToast} />
        {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
        
        {isMockMode && (
            <div className="fixed bottom-0 left-0 right-0 bg-yellow-500/90 text-black text-center text-xs font-bold py-1 z-[100] pointer-events-none">
                PREVIEW MODE: Local Data Only
            </div>
        )}
      </main>
    </div>
  );
};

const AuthWrapper: React.FC = () => {
    const { user, isLoaded, isSignedIn } = useUser();
    const { getToken, signOut } = useAuth();
    const { organization } = useOrganization();

    return (
        <AppLayout 
            clerkUser={user} 
            isLoaded={isLoaded} 
            isSignedIn={!!isSignedIn} 
            getToken={getToken} 
            signOut={signOut} 
            authMode="clerk" 
            organization={organization}
            userObj={user}
        />
    );
};

const App: React.FC = () => {
    const env = (import.meta as any).env || {};
    const clerkPubKey = env.VITE_CLERK_PUBLISHABLE_KEY;
    const isMockMode = !clerkPubKey || clerkPubKey.includes('placeholder');

    if (isMockMode) {
        return (
            <ErrorBoundary>
                <LanguageProvider>
                    <ThemeProvider>
                        <DriveProvider isMockMode={true}>
                            <AppLayout 
                                clerkUser={{ id: 'mock-user', fullName: 'Mock User', imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mock', primaryEmailAddress: { emailAddress: 'mock@example.com' } }} 
                                isLoaded={true} 
                                isSignedIn={true} 
                                getToken={async () => 'mock-token'} 
                                signOut={async () => window.location.reload()} 
                                mockSignIn={() => {}}
                                authMode="mock" 
                            />
                        </DriveProvider>
                    </ThemeProvider>
                </LanguageProvider>
            </ErrorBoundary>
        );
    }

    if (!clerkPubKey) {
        return <div>Missing Clerk Key</div>;
    }

    // Wrap ClerkProvider in ErrorBoundary to catch initial connection failures (like blocked QUIC/UDP)
    return (
        <ErrorBoundary>
            <ClerkProvider publishableKey={clerkPubKey}>
                <LanguageProvider>
                    <ThemeProvider>
                        <LanguageCloudSync />
                        <ThemeCloudSync />
                        <DriveProvider isMockMode={false}>
                            <AuthWrapper />
                        </DriveProvider>
                    </ThemeProvider>
                </LanguageProvider>
            </ClerkProvider>
        </ErrorBoundary>
    );
};

export default App;