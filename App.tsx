
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProjectView } from './components/ProjectView';
import { Player } from './components/Player';
import { Login } from './components/Login';
import { Profile } from './components/Profile';
import { WorkflowPage, AboutPage, PricingPage, AiFeaturesPage } from './components/StaticPages';
import { LiveDemo } from './components/LiveDemo';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { Project, ProjectAsset, User, StorageType, UploadTask } from './types';
import { generateId } from './services/utils';
import { LanguageProvider, LanguageCloudSync } from './services/i18n';
import { ThemeProvider, ThemeCloudSync } from './services/theme';
import { MainLayout } from './components/MainLayout';
import { GoogleDriveService } from './services/googleDrive';
import { useUser, useClerk, useAuth, ClerkProvider } from '@clerk/clerk-react';
import { api } from './services/apiClient';
import { Loader2, UploadCloud, X, CheckCircle, AlertCircle } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShortcutsModal } from './components/ShortcutsModal';
import { useUploadManager } from './hooks/useUploadManager';

type ViewState = 
  | { type: 'DASHBOARD' }
  | { type: 'PROJECT_VIEW', projectId: string, restrictedAssetId?: string }
  | { type: 'PLAYER', assetId: string, projectId: string, restrictedAssetId?: string }
  | { type: 'PROFILE' }
  | { type: 'WORKFLOW' }
  | { type: 'ABOUT' }
  | { type: 'PRICING' }
  | { type: 'AI_FEATURES' }
  | { type: 'LIVE_DEMO' };

const POLLING_INTERVAL_MS = 10000;

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
}

const AppLayout: React.FC<AppLayoutProps> = ({ clerkUser, isLoaded, isSignedIn, getToken, signOut, mockSignIn, authMode, organization }) => {
  const isMockMode = authMode === 'mock';
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<ViewState>({ type: 'DASHBOARD' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Track the last local modification to prevent server overwrites
  const lastLocalUpdateRef = useRef<number>(0);

  const notify = (message: string, type: ToastType = 'info') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

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
            avatar: clerkUser.imageUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev'
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
                    window.dispatchEvent(new Event('drive-token-updated'));
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
  }, [isSignedIn, getToken, isMockMode]);

  const handleLogout = async () => {
    if (isSignedIn) {
        await signOut();
    } 
    setView({ type: 'DASHBOARD' });
  };

  const fetchCloudData = useCallback(async (userOverride?: User) => {
      const userToUse = userOverride || currentUser;
      if (!userToUse) return;
      
      // Don't fetch if we just modified data locally to prevent flickering
      if (Date.now() - lastLocalUpdateRef.current < 2000) {
          return;
      }

      let token: string | null = null;
      if (authMode === 'clerk') {
          try { token = await getToken(); } catch (e) {}
      }

      try {
         setIsSyncing(true);
         const data = await api.getProjects(userToUse, token, organization?.id);
         if (data && Array.isArray(data)) {
            setProjects(data);
         }
      } catch (e) {
         console.error("Fetch failed", e);
      } finally {
         setIsSyncing(false);
      }
  }, [currentUser, getToken, authMode, organization]);

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
          }
      } catch (e: any) {
          console.error("Sync failed", e);
          
          if (e.code === 'CONFLICT') {
              notify("Conflict detected. Reloading...", "warning");
              lastLocalUpdateRef.current = 0; // Allow immediate poll
              fetchCloudData(); 
          } else {
              notify("Failed to save changes. Check internet.", "error");
          }
      } finally {
          setIsSyncing(false);
      }
  };

  // --- USE UPLOAD MANAGER HOOK ---
  const { uploadTasks, handleUploadAsset, removeUploadTask } = useUploadManager(
      currentUser,
      projects,
      setProjects,
      notify,
      forceSync,
      lastLocalUpdateRef,
      isMockMode,
      getToken // Pass auth method
  );

  useEffect(() => {
    if (!currentUser) return; 
    fetchCloudData();
  }, [currentUser, fetchCloudData]);

  useEffect(() => {
    if (!currentUser || isMockMode) return;
    const shouldPoll = ['DASHBOARD', 'PROJECT_VIEW', 'PLAYER'].includes(view.type);
    if (!shouldPoll) return;

    const interval = setInterval(() => {
        if (isSyncing) return;
        fetchCloudData();
    }, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isSyncing, currentUser, view.type, isMockMode, fetchCloudData]);

  useEffect(() => {
    if (!currentUser) return;

    const params = new URLSearchParams(window.location.search);
    const pId = params.get('projectId');
    const aId = params.get('assetId');

    if (pId) {
      const projectExists = projects.find(p => p.id === pId);
      
      if (projectExists) {
            if (aId) {
                const assetExists = projectExists.assets.find(a => a.id === aId);
                if (assetExists) setView({ type: 'PLAYER', projectId: pId, assetId: aId });
                else setView({ type: 'PROJECT_VIEW', projectId: pId });
            } else {
                setView({ type: 'PROJECT_VIEW', projectId: pId });
            }
      }
    }
  }, [currentUser, projects]); 

  const handleSelectProject = (project: Project) => {
    setView({ type: 'PROJECT_VIEW', projectId: project.id });
    const newUrl = `${window.location.pathname}?projectId=${project.id}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
  };

  const handleSelectAsset = (asset: ProjectAsset) => {
    if (view.type === 'PROJECT_VIEW') {
      setView({ type: 'PLAYER', assetId: asset.id, projectId: view.projectId, restrictedAssetId: view.restrictedAssetId });
      const newUrl = `${window.location.pathname}?projectId=${view.projectId}&assetId=${asset.id}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  };

  const handleBackToDashboard = () => {
    setView({ type: 'DASHBOARD' });
    window.history.pushState({}, '', window.location.pathname);
  };

  const handleBackToProject = () => {
    if (view.type === 'PLAYER') {
      setView({ type: 'PROJECT_VIEW', projectId: view.projectId, restrictedAssetId: view.restrictedAssetId });
      const newUrl = `${window.location.pathname}?projectId=${view.projectId}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  };

  const handleUpdateProject = (updatedProject: Project, skipSync = false) => {
    const newProjects = projects.map(p => p.id === updatedProject.id ? updatedProject : p);
    setProjects(newProjects);
    if (!skipSync) {
        forceSync(newProjects);
    }
  };
  
  const handleEditProject = (projectId: string, data: Partial<Project>) => {
      const updated = projects.map(p => p.id === projectId ? { ...p, ...data, updatedAt: 'Just now' } : p);
      setProjects(updated);
      forceSync(updated);
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
      switch(page) {
          case 'WORKFLOW': setView({ type: 'WORKFLOW' }); break;
          case 'ABOUT': setView({ type: 'ABOUT' }); break;
          case 'PRICING': setView({ type: 'PRICING' }); break;
          case 'PROFILE': setView({ type: 'PROFILE' }); break;
          case 'AI_FEATURES': setView({ type: 'AI_FEATURES' }); break;
          case 'LIVE_DEMO': setView({ type: 'LIVE_DEMO' }); break;
          default: setView({ type: 'DASHBOARD' });
      }
  };

  if (!isLoaded) {
      return (
          <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center">
              <Loader2 size={32} className="text-indigo-500 animate-spin" />
          </div>
      );
  }

  if (view.type === 'LIVE_DEMO') {
      return <LiveDemo onBack={() => handleNavigate('DASHBOARD')} />;
  }

  const currentProject = (view.type === 'PROJECT_VIEW' || view.type === 'PLAYER') ? projects.find(p => p.id === view.projectId) : null;
  const currentAsset = (view.type === 'PLAYER' && currentProject) ? currentProject.assets.find(a => a.id === view.assetId) : null;

  if (!currentUser) {
      const isPublicView = ['WORKFLOW', 'ABOUT', 'PRICING', 'AI_FEATURES'].includes(view.type);
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
                </MainLayout>
                <ToastContainer toasts={toasts} removeToast={removeToast} />
                {isMockMode && (
                    <div className="fixed bottom-0 left-0 right-0 bg-yellow-500/90 text-black text-center text-xs font-bold py-1 z-[100] backdrop-blur-sm">
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

  const isPlatformView = ['DASHBOARD', 'PROFILE', 'WORKFLOW', 'ABOUT', 'PRICING', 'AI_FEATURES'].includes(view.type);

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
                />
                )}
                {view.type === 'PROFILE' && (
                    <Profile 
                        currentUser={currentUser}
                        onLogout={handleLogout}
                    />
                )}
                {view.type === 'WORKFLOW' && <WorkflowPage />}
                {view.type === 'ABOUT' && <AboutPage />}
                {view.type === 'PRICING' && <PricingPage />}
                {view.type === 'AI_FEATURES' && <AiFeaturesPage />}
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

const ClerkWrapper: React.FC = () => {
    const { user, isLoaded, isSignedIn } = useUser();
    const { getToken, signOut } = useAuth();
    const { openSignIn, organization } = useClerk();
    
    // Clerk provides the active organization here if one is selected
    const activeOrg = organization;

    return (
        <AppLayout 
            clerkUser={user}
            isLoaded={isLoaded}
            isSignedIn={isSignedIn || false}
            getToken={getToken}
            signOut={async () => { await signOut(); }}
            mockSignIn={() => openSignIn()}
            authMode="clerk"
            organization={activeOrg}
        />
    );
}

const App: React.FC = () => {
    const env = (import.meta as any).env || {};
    const clerkKey = env.VITE_CLERK_PUBLISHABLE_KEY;
    const isMock = !clerkKey || clerkKey.includes('placeholder');

    const MockAppWrapper = () => {
        const [isMockSignedIn, setIsMockSignedIn] = useState(false);
        const [mockUser, setMockUser] = useState<any | null>(null);

        const handleMockSignIn = () => {
            setIsMockSignedIn(true);
            setMockUser({
                id: 'mock-user-1',
                fullName: 'Mock Developer',
                imageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mock',
                primaryEmailAddressId: 'email-1',
                emailAddresses: [{ id: 'email-1', emailAddress: 'mock@example.com' }]
            });
        };

        const handleMockSignOut = async () => {
            setIsMockSignedIn(false);
            setMockUser(null);
        };

        return (
            <AppLayout 
                clerkUser={mockUser}
                isLoaded={true}
                isSignedIn={isMockSignedIn}
                getToken={async () => 'mock-token'}
                signOut={handleMockSignOut}
                mockSignIn={handleMockSignIn}
                authMode="mock"
                organization={null}
            />
        );
    };

    if (isMock) {
        return (
            <LanguageProvider>
                <ThemeProvider>
                    <MockAppWrapper />
                </ThemeProvider>
            </LanguageProvider>
        );
    }

    return (
        <ClerkProvider publishableKey={clerkKey}>
            <LanguageProvider>
                <ThemeProvider>
                    <LanguageCloudSync />
                    <ThemeCloudSync />
                    <ClerkWrapper />
                </ThemeProvider>
            </LanguageProvider>
        </ClerkProvider>
    );
};

export default App;
