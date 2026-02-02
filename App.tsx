
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
import { Loader2, User as UserIcon, ArrowRight } from 'lucide-react';
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
  
  // GUEST STATE
  const [guestName, setGuestName] = useState(() => localStorage.getItem('smotree_guest_name') || '');
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);

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

  // COMPUTED USER (Real or Guest)
  const effectiveUser: User | null = React.useMemo(() => {
      if (currentUser) return currentUser;
      
      // If we are in public mode (projects loaded) but no login, return Guest User
      // Only if guestName is set, otherwise we might return a temp placeholder or null
      if (!isSignedIn && guestName) {
          return {
              id: `guest-${guestName.replace(/\s+/g, '-').toLowerCase()}-${localStorage.getItem('smotree_guest_id') || generateId()}`,
              name: guestName,
              avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${guestName}&backgroundColor=e5e7eb`
          };
      }
      // Temporary fallback to prevent crashes before name entry
      if (!isSignedIn && projects.length > 0) {
           return { id: 'guest-pending', name: 'Guest', avatar: '' };
      }
      return null;
  }, [currentUser, isSignedIn, guestName, projects.length]);

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
    } else {
        // Guest Logout
        localStorage.removeItem('smotree_guest_name');
        setGuestName('');
    }
    setView({ type: 'DASHBOARD' });
    window.history.pushState({}, '', '/');
  };

  const fetchCloudData = useCallback(async (userOverride?: User, force = false) => {
      // Check URL parameters for direct link access
      const params = new URLSearchParams(window.location.search);
      const directProjectId = params.get('projectId');

      const userToUse = userOverride || effectiveUser; // Use effective user (Guest or Real)
      
      // ALLOW ACCESS if directProjectId exists, even if user is null
      if (!userToUse && !directProjectId) return;
      
      // Don't fetch if we just modified data locally to prevent flickering
      if (Date.now() - lastLocalUpdateRef.current < 2000) {
          return;
      }

      let token: string | null = null;
      if (authMode === 'clerk') {
          try { token = await getToken(); } catch (e) {}
      }

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
        // Pass null as user if using guest link to trigger public logic
        const fetchUser = isSignedIn ? userToUse : null;
        const data = await api.getProjects(fetchUser, token, organization?.id, directProjectId || undefined);
        setProjects(data);
      } catch (e) {
        console.error("Fetch failed", e);
      }
  }, [effectiveUser, isSignedIn, isMockMode, authMode, organization?.id, getToken]);

  // Initial Fetch & Polling
  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const directProjectId = params.get('projectId');

      if (currentUser || directProjectId) {
          fetchCloudData(currentUser || undefined, true);
          
          if (!isMockMode) {
              const interval = setInterval(() => fetchCloudData(), POLLING_INTERVAL_MS);
              return () => clearInterval(interval);
          }
      } else {
          setProjects([]);
      }
  }, [currentUser, fetchCloudData, isMockMode]);

  // --- GUEST MODAL LOGIC ---
  useEffect(() => {
      // If user is NOT signed in, but has loaded projects (via public link), 
      // AND hasn't set a name yet -> Show Modal
      const isPublicAccess = !isSignedIn && projects.length > 0;
      if (isPublicAccess && !guestName) {
          setIsGuestModalOpen(true);
      } else {
          setIsGuestModalOpen(false);
      }
  }, [isSignedIn, projects.length, guestName]);

  const handleSetGuestName = (name: string) => {
      if (!name.trim()) return;
      localStorage.setItem('smotree_guest_name', name);
      if (!localStorage.getItem('smotree_guest_id')) {
          localStorage.setItem('smotree_guest_id', generateId());
      }
      setGuestName(name);
      setIsGuestModalOpen(false);
  };

  const { uploadTasks, handleUploadAsset, removeUploadTask } = useUploadManager(
      effectiveUser, projects, setProjects, notify, 
      async (p) => { await api.syncProjects(p, effectiveUser, null); }, 
      lastLocalUpdateRef, isMockMode, getToken
  );

  // --- ACTIONS ---
  const handleAddProject = async (project: Project) => {
      setProjects(prev => [project, ...prev]);
      notify(t('notify.proj_created'), "success");
      
      if (!isMockMode) {
          try {
              await api.syncProjects([project], effectiveUser);
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
      
      if (!skipSync && !isMockMode && effectiveUser) {
          setIsSyncing(true);
          try {
              // Note: Guests usually can't save project-level changes (DB checks rights), 
              // but can save comments (handled in Player.tsx via api.comment)
              await api.syncProjects([updatedProject], effectiveUser);
          } catch (e) {
              console.error("Sync error", e);
              // Don't show error for guests if it's just a permission issue on full project sync
              if (isSignedIn) notify("Failed to save changes", "error");
          } finally {
              setIsSyncing(false);
          }
      }
  };

  const renderContent = () => {
    const publicViews = ['WORKFLOW', 'ABOUT', 'PRICING', 'AI_FEATURES', 'LIVE_DEMO', 'DASHBOARD'];
    
    // GUEST ACCESS: If viewing project/player and not signed in, check if project is loaded (Public Access)
    const isPublicProjectView = (view.type === 'PROJECT_VIEW' || view.type === 'PLAYER') && projects.length > 0;

    if (!isSignedIn && !isMockMode && !publicViews.includes(view.type) && !isPublicProjectView) {
        return <Login onLogin={() => {}} onNavigate={(page) => setView({ type: page as any })} />;
    }

    if (!isSignedIn && !isMockMode && view.type === 'DASHBOARD' && !isPublicProjectView) {
         return <Login onLogin={() => {}} onNavigate={(page) => setView({ type: page as any })} />;
    }
    
    // LIVE DEMO
    if (view.type === 'LIVE_DEMO') {
        return <LiveDemo onBack={() => { setView({ type: 'DASHBOARD' }); window.history.pushState({}, '', '/'); }} />;
    }

    // STATIC PAGES
    if (['WORKFLOW', 'ABOUT', 'PRICING', 'AI_FEATURES'].includes(view.type)) {
        return (
             <MainLayout currentUser={effectiveUser} currentView={view.type} onNavigate={(p) => setView({ type: p as any })} onBack={() => setView({ type: 'DASHBOARD' })}>
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
         <MainLayout currentUser={effectiveUser} currentView="DASHBOARD" onNavigate={(p) => setView({ type: p as any })} onBack={() => {}}>
           <Dashboard 
             projects={projects}
             currentUser={effectiveUser || { id: 'guest', name: 'Guest', avatar: '' }}
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
       if (!project) return <div className="p-8 text-center text-zinc-500"><Loader2 className="animate-spin inline mr-2"/> Loading Project...</div>;
       
       return (
          <ProjectView 
             project={project}
             currentUser={effectiveUser || { id: 'guest', name: 'Guest', avatar: '' }}
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
        if (!project) return <div className="p-8 text-center text-zinc-500"><Loader2 className="animate-spin inline mr-2"/> Loading...</div>;
        
        const asset = project.assets.find(a => a.id === view.assetId);
        if (!asset) return <div className="p-8 text-center text-red-500">Asset not found</div>;

        return (
            <Player 
              asset={asset}
              project={project}
              currentUser={effectiveUser || { id: 'guest', name: 'Guest', avatar: '' }}
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

    if (view.type === 'PROFILE' && effectiveUser) {
        return (
             <MainLayout currentUser={effectiveUser} currentView="PROFILE" onNavigate={(p) => setView({ type: p as any })} onBack={() => setView({ type: 'DASHBOARD' })}>
                 <Profile currentUser={effectiveUser} onLogout={handleLogout} />
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

            {/* GUEST NAME MODAL */}
            {isGuestModalOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 relative animate-in zoom-in-95">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                <UserIcon size={32} className="text-zinc-400" />
                            </div>
                            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Welcome</h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                                Please enter your name to join the review. This name will appear on your comments.
                            </p>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleSetGuestName((e.target as any).elements.name.value); }}>
                            <input 
                                name="name"
                                type="text" 
                                autoFocus 
                                placeholder="Your Name" 
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-center font-bold text-lg outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all mb-4"
                            />
                            <button 
                                type="submit" 
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-500/20"
                            >
                                Continue to Review <ArrowRight size={18} />
                            </button>
                        </form>
                    </div>
                </div>
            )}
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
