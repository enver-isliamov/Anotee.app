
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
import { LanguageProvider, LanguageCloudSync, useLanguage } from './services/i18n';
import { ThemeProvider, ThemeCloudSync } from './services/theme';
import { MainLayout } from './components/MainLayout';
import { GoogleDriveService } from './services/googleDrive';
import { useUser, useClerk, useAuth, ClerkProvider, useOrganization } from '@clerk/clerk-react';
import { api } from './services/apiClient';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ShortcutsModal } from './components/ShortcutsModal';
import { useUploadManager } from './hooks/useUploadManager';
import { DriveProvider, useDrive } from './services/driveContext';

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

// INCREASED TO 20s to prevent Rate Limiting on full Auth checks
const POLLING_INTERVAL_MS = 20000;

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
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<ViewState>({ type: 'DASHBOARD' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // Use Drive Context
  const { checkDriveConnection } = useDrive();

  // Track the last local modification to prevent server overwrites
  const lastLocalUpdateRef = useRef<number>(0);
  
  // Track last known server data timestamp to minimize fetching
  const lastServerTimestampRef = useRef<number>(0);

  const notify = (message: string, type: ToastType = 'info') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- NAVIGATION HANDLER (HISTORY API) ---
  useEffect(() => {
    const handlePopState = () => {
        const params = new URLSearchParams(window.location.search);
        const pId = params.get('projectId');
        const aId = params.get('assetId');

        if (pId && aId) {
            setView({ type: 'PLAYER', projectId: pId, assetId: aId });
        } else if (pId) {
            setView({ type: 'PROJECT_VIEW', projectId: pId });
        } else {
            setView({ type: 'DASHBOARD' });
        }
    };

    window.addEventListener('popstate', handlePopState);
    handlePopState(); // Initial check
    
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

  const fetchCloudData = useCallback(async (userOverride?: User, force = false) => {
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

      // Check URL parameters for direct link access
      const params = new URLSearchParams(window.location.search);
      const directProjectId = params.get('projectId');

      // OPTIMIZATION: Check if we need to fetch full data
      if (!force && !directProjectId && !isMockMode) {
          try {
              const lastModified = await api.checkUpdates(organization?.id);
              if (lastModified > 0 && lastModified <= lastServerTimestampRef.current) {
                  return;
              }
              if (lastModified > 0) lastServerTimestampRef.current = lastModified;
          } catch (e) {
             console.warn("Polling check failed", e);
          }
      }

      try {
        const data = await api.getProjects(userToUse, token, organization?.id, directProjectId || undefined);
        setProjects(data);
      } catch (e) {
        console.error("Fetch failed", e);
      }
  }, [currentUser, isMockMode, authMode, organization?.id, getToken]);

  // Initial Fetch & Polling
  useEffect(() => {
      if (currentUser) {
          fetchCloudData(currentUser, true);
          
          if (!isMockMode) {
              const interval = setInterval(() => fetchCloudData(), POLLING_INTERVAL_MS);
              return () => clearInterval(interval);
          }
      } else {
          setProjects([]);
      }
  }, [currentUser, fetchCloudData, isMockMode]);

  const { uploadTasks, handleUploadAsset, removeUploadTask } = useUploadManager(
      currentUser, projects, setProjects, notify, 
      async (p) => { await api.syncProjects(p, currentUser, null); }, 
      lastLocalUpdateRef, isMockMode, getToken
  );

  // --- ACTIONS ---
  const handleAddProject = async (project: Project) => {
      setProjects(prev => [project, ...prev]);
      notify(t('notify.proj_created'), "success");
      
      if (!isMockMode) {
          try {
              await api.syncProjects([project], currentUser);
          } catch(e) { 
              notify("Failed to sync new project", "error"); 
          }
      }
  };

  const handleDeleteProject = (id: string) => {
      setProjects(prev => prev.filter(p => p.id !== id));
      // Dashboard component handles API call
  };

  const handleEditProject = (id: string, updates: Partial<Project>) => {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
      // Dashboard component handles API call
  };

  const handleUpdateProject = async (updatedProject: Project, skipSync = false) => {
      setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      lastLocalUpdateRef.current = Date.now();
      
      if (!skipSync && !isMockMode && currentUser) {
          setIsSyncing(true);
          try {
              await api.syncProjects([updatedProject], currentUser);
          } catch (e) {
              console.error("Sync error", e);
              notify("Failed to save changes", "error");
          } finally {
              setIsSyncing(false);
          }
      }
  };

  const renderContent = () => {
    // If not logged in and not in a public view, show Login (Landing)
    const publicViews = ['WORKFLOW', 'ABOUT', 'PRICING', 'AI_FEATURES', 'LIVE_DEMO', 'DASHBOARD'];
    if (!isSignedIn && !isMockMode && !publicViews.includes(view.type) && view.type !== 'PROJECT_VIEW' && view.type !== 'PLAYER') {
        return <Login onLogin={() => {}} onNavigate={(page) => setView({ type: page as any })} />;
    }

    if (!isSignedIn && !isMockMode && view.type === 'DASHBOARD') {
         return <Login onLogin={() => {}} onNavigate={(page) => setView({ type: page as any })} />;
    }
    
    // LIVE DEMO
    if (view.type === 'LIVE_DEMO') {
        return <LiveDemo onBack={() => { setView({ type: 'DASHBOARD' }); window.history.pushState({}, '', '/'); }} />;
    }

    // STATIC PAGES
    if (['WORKFLOW', 'ABOUT', 'PRICING', 'AI_FEATURES'].includes(view.type)) {
        return (
             <MainLayout currentUser={currentUser} currentView={view.type} onNavigate={(p) => setView({ type: p as any })} onBack={() => setView({ type: 'DASHBOARD' })}>
                {view.type === 'WORKFLOW' && <WorkflowPage />}
                {view.type === 'ABOUT' && <AboutPage />}
                {view.type === 'PRICING' && <PricingPage />}
                {view.type === 'AI_FEATURES' && <AiFeaturesPage />}
             </MainLayout>
        );
    }
    
    // AUTHENTICATED VIEWS
    if (view.type === 'DASHBOARD') {
       return (
         <MainLayout currentUser={currentUser} currentView="DASHBOARD" onNavigate={(p) => setView({ type: p as any })} onBack={() => {}}>
           <Dashboard 
             projects={projects}
             currentUser={currentUser || { id: 'guest', name: 'Guest', avatar: '' }}
             onSelectProject={(p) => { 
                 setView({ type: 'PROJECT_VIEW', projectId: p.id });
                 window.history.pushState({}, '', `?projectId=${p.id}`);
             }}
             onAddProject={handleAddProject}
             onDeleteProject={handleDeleteProject}
             onEditProject={handleEditProject}
             onNavigate={(page) => setView({ type: page as any })}
             notify={notify}
             isMockMode={isMockMode}
           />
         </MainLayout>
       );
    }

    if (view.type === 'PROJECT_VIEW') {
       const project = projects.find(p => p.id === view.projectId);
       if (!project) return <div className="p-8 text-center"><Loader2 className="animate-spin inline mr-2"/> Loading Project...</div>;
       
       return (
          <ProjectView 
             project={project}
             currentUser={currentUser || { id: 'guest', name: 'Guest', avatar: '' }}
             onBack={() => {
                 setView({ type: 'DASHBOARD' });
                 window.history.pushState({}, '', '/');
             }}
             onSelectAsset={(asset) => {
                 setView({ type: 'PLAYER', projectId: project.id, assetId: asset.id });
                 window.history.pushState({}, '', `?projectId=${project.id}&assetId=${asset.id}`);
             }}
             onUpdateProject={handleUpdateProject}
             notify={notify}
             isMockMode={isMockMode}
             restrictedAssetId={view.restrictedAssetId}
             onUploadAsset={handleUploadAsset}
             uploadTasks={uploadTasks} // Pass upload tasks to ProjectView
          />
       );
    }

    if (view.type === 'PLAYER') {
        const project = projects.find(p => p.id === view.projectId);
        if (!project) return <div className="p-8 text-center"><Loader2 className="animate-spin inline mr-2"/> Loading...</div>;
        
        const asset = project.assets.find(a => a.id === view.assetId);
        if (!asset) return <div className="p-8 text-center text-red-500">Asset not found</div>;

        return (
            <Player 
              asset={asset}
              project={project}
              currentUser={currentUser || { id: 'guest', name: 'Guest', avatar: '' }}
              onBack={() => {
                  setView({ type: 'PROJECT_VIEW', projectId: project.id });
                  window.history.pushState({}, '', `?projectId=${project.id}`);
              }}
              users={project.team || []}
              onUpdateProject={handleUpdateProject}
              isSyncing={isSyncing}
              notify={notify}
              isMockMode={isMockMode}
            />
        );
    }

    if (view.type === 'PROFILE' && currentUser) {
        return (
             <MainLayout currentUser={currentUser} currentView="PROFILE" onNavigate={(p) => setView({ type: p as any })} onBack={() => setView({ type: 'DASHBOARD' })}>
                 <Profile currentUser={currentUser} onLogout={handleLogout} />
             </MainLayout>
        );
    }

    return null;
  };

  return (
    <ErrorBoundary>
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300">
            {renderContent()}
            
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            
            {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
        </div>
    </ErrorBoundary>
  );
};

const App: React.FC = () => {
    // Check environment for Clerk
    const clerkKey = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY;
    const isClerkConfigured = clerkKey && !clerkKey.includes('placeholder');

    if (!isClerkConfigured) {
        return (
            <ThemeProvider>
                <LanguageProvider>
                     <DriveProvider isMockMode={true}>
                         {/* Mock Mode Wrapper if Clerk is missing */}
                         <AppLayout 
                            clerkUser={{ id: 'mock-user', firstName: 'Mock', lastName: 'User' }}
                            isLoaded={true}
                            isSignedIn={true}
                            getToken={async () => 'mock-token'}
                            signOut={async () => {}}
                            authMode='mock'
                         />
                     </DriveProvider>
                </LanguageProvider>
            </ThemeProvider>
        );
    }

    return (
        <ClerkProvider publishableKey={clerkKey}>
             <AuthWrapper />
        </ClerkProvider>
    );
};

// Wrapper to access Clerk Hooks inside Provider
const AuthWrapper: React.FC = () => {
    const { user, isLoaded, isSignedIn } = useUser();
    const { getToken, signOut } = useAuth();
    const { organization } = useOrganization();

    return (
        <ThemeProvider>
            <LanguageProvider>
                <LanguageCloudSync />
                <ThemeCloudSync />
                <DriveProvider isMockMode={false}>
                    <AppLayout 
                        clerkUser={user} 
                        isLoaded={isLoaded} 
                        isSignedIn={isSignedIn || false} 
                        getToken={getToken} 
                        signOut={signOut}
                        authMode='clerk'
                        organization={organization}
                    />
                </DriveProvider>
            </LanguageProvider>
        </ThemeProvider>
    );
};

export default App;
