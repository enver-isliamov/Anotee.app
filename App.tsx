
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProjectView } from './components/ProjectView';
import { Player } from './components/Player';
import { Login } from './components/Login';
import { Profile } from './components/Profile';
import { WorkflowPage, AboutPage, PricingPage, AiFeaturesPage } from './components/StaticPages';
import { LiveDemo } from './components/LiveDemo';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { Project, ProjectAsset, User, UserRole } from './types';
import { generateId } from './services/utils';
import { LanguageProvider } from './services/i18n';
import { ThemeProvider } from './services/theme';
import { MainLayout } from './components/MainLayout';
import { GoogleDriveService } from './services/googleDrive';
import { useUser, useClerk, useAuth, ClerkProvider } from '@clerk/clerk-react';
import { api } from './services/apiClient';

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

const GUEST_STORAGE_KEY = 'smotree_guest_user';
const GUEST_TOKEN_KEY = 'smotree_guest_token';
const POLLING_INTERVAL_MS = 5000;

interface AppLayoutProps {
    clerkUser: any | null;
    isLoaded: boolean;
    isSignedIn: boolean;
    getToken: () => Promise<string | null>;
    signOut: () => Promise<void>;
    mockSignIn?: () => void; // Added for Mock Mode
    authMode: 'clerk' | 'guest' | 'mock';
}

const AppLayout: React.FC<AppLayoutProps> = ({ clerkUser, isLoaded, isSignedIn, getToken, signOut, mockSignIn, authMode }) => {
  // Local Guest User State
  const [guestUser, setGuestUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(GUEST_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  const isMockMode = authMode === 'mock';

  // Derived Current User
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<ViewState>({ type: 'DASHBOARD' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isRemoteUpdate = useRef(false);
  const isJoiningFlow = useRef(false);
  const processedInvites = useRef<Set<string>>(new Set()); 

  // TOAST HANDLER
  const notify = (message: string, type: ToastType = 'info') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // --- SYNC AUTH STATE ---
  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && clerkUser) {
        // Authenticated via Clerk or Mock Admin
        setCurrentUser({
            id: clerkUser.id,
            name: clerkUser.fullName || clerkUser.firstName || 'Developer',
            avatar: clerkUser.imageUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev',
            role: UserRole.ADMIN 
        });
        if (guestUser) {
            setGuestUser(null);
            localStorage.removeItem(GUEST_STORAGE_KEY);
            localStorage.removeItem(GUEST_TOKEN_KEY);
        }
    } else if (guestUser) {
        // Fallback to Guest
        setCurrentUser(guestUser);
    } else {
        setCurrentUser(null);
    }
  }, [isLoaded, isSignedIn, clerkUser, guestUser]);

  // Notify if running in Mock/Guest Mode
  useEffect(() => {
      if (authMode === 'guest' && !localStorage.getItem('smotree_guest_warned')) {
          setTimeout(() => {
             notify("Running in Offline Guest Mode", "warning");
             localStorage.setItem('smotree_guest_warned', 'true');
          }, 1000);
      }
  }, [authMode]);

  // --- CONFIGURE API & DRIVE SERVICES ---
  useEffect(() => {
    // 1. Configure Main API
    api.setTokenProvider(getToken);

    // 2. Configure Google Drive Service
    if (isSignedIn && !isMockMode) {
        GoogleDriveService.setTokenProvider(async () => {
            try {
                // This is the CRITICAL integration point
                const clerkToken = await getToken();
                if (!clerkToken) {
                    console.warn("⚠️ App: No Clerk Token available for Drive request");
                    return null;
                }
                
                const res = await fetch('/api/driveToken', {
                    headers: { 'Authorization': `Bearer ${clerkToken}` }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    // Fire an event to notify components that token is ready
                    window.dispatchEvent(new Event('drive-token-updated'));
                    return data.token; 
                } else {
                    // console.error(`❌ App: Drive Token Fetch Failed. Status: ${res.status}`);
                    return null;
                }
            } catch (e) {
                console.error("❌ App: Network Error fetching drive token", e);
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
    } else {
        setGuestUser(null);
        localStorage.removeItem(GUEST_STORAGE_KEY);
        localStorage.removeItem(GUEST_TOKEN_KEY);
    }
    setView({ type: 'DASHBOARD' });
  };

  const fetchCloudData = useCallback(async (userOverride?: User) => {
      const userToUse = userOverride || currentUser;
      if (!userToUse) return;
      
      // EXPLICIT TOKEN FETCH: Fixes race condition where api.setTokenProvider hasn't run yet.
      let token: string | null = null;
      if (authMode === 'clerk') {
          try {
              token = await getToken();
          } catch (e) {
              console.warn("Failed to fetch fresh token during data sync", e);
          }
      }

      try {
         setIsSyncing(true);
         // Pass explicit token to API
         const data = await api.getProjects(userToUse, token);
         
         if (data && Array.isArray(data)) {
            isRemoteUpdate.current = true;
            setProjects(data);
         }
      } catch (e) {
         console.error("Fetch failed", e);
      } finally {
         setIsSyncing(false);
      }
  }, [currentUser, getToken, authMode]);

  const forceSync = async (projectsData: Project[]) => {
      if (!currentUser) return;
      
      let token: string | null = null;
      if (authMode === 'clerk') {
          try { token = await getToken(); } catch(e) {}
      }

      try {
          setIsSyncing(true);
          await api.syncProjects(projectsData, currentUser, token);
      } catch (e) {
          console.error("Sync failed", e);
      } finally {
          setIsSyncing(false);
      }
  };

  useEffect(() => {
    if (!currentUser || isJoiningFlow.current) return; 
    fetchCloudData();
  }, [currentUser, fetchCloudData]);

  useEffect(() => {
    if (!currentUser || isMockMode) return;
    
    const shouldPoll = ['DASHBOARD', 'PROJECT_VIEW', 'PLAYER'].includes(view.type);
    if (!shouldPoll) return;

    const interval = setInterval(() => {
        if (isSyncing || isJoiningFlow.current) return;
        fetchCloudData();
    }, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isSyncing, currentUser, view.type, isMockMode, fetchCloudData]);

  const processInviteLink = async (user: User, projectId: string, assetId?: string | null) => {
      if (processedInvites.current.has(projectId)) return; 
      
      isJoiningFlow.current = true;
      notify("Accepting invitation...", "info");

      let token: string | null = null;
      if (authMode === 'clerk') {
          try { token = await getToken(); } catch(e) {}
      }

      try {
          const result = await api.joinProject(projectId, user, token);
          
          if (result.success && result.project) {
              processedInvites.current.add(projectId);
              isRemoteUpdate.current = true;
              setProjects(prev => {
                  const exists = prev.some(p => p.id === result.project!.id);
                  if (exists) return prev.map(p => p.id === result.project!.id ? result.project! : p);
                  return [result.project!, ...prev]; 
              });
              notify(`You joined "${result.project.name}"`, "success");
              
              if (assetId) {
                  setView({ type: 'PLAYER', projectId: projectId, assetId: assetId, restrictedAssetId: assetId });
              } else {
                  setView({ type: 'PROJECT_VIEW', projectId: projectId });
              }
              
              // Clean URL
              const url = new URL(window.location.href);
              url.searchParams.delete('projectId');
              if (assetId) url.searchParams.delete('assetId');
              window.history.replaceState({}, '', url.toString());
          } else {
               notify("Failed to join project.", "error");
               // CRITICAL FIX: Mark as processed even on failure to prevent infinite loops
               processedInvites.current.add(projectId);
          }
      } catch (e) {
          console.error("Join flow error:", e);
          notify("Network error joining project.", "error");
          processedInvites.current.add(projectId);
      } finally {
          setTimeout(() => { isJoiningFlow.current = false; }, 1000);
          await fetchCloudData(user);
      }
  };

  useEffect(() => {
    if (!currentUser) return;

    const params = new URLSearchParams(window.location.search);
    const pId = params.get('projectId');
    const aId = params.get('assetId');

    if (pId && !projects.some(p => p.id === pId)) {
        processInviteLink(currentUser, pId, aId);
        return; 
    } 
    
    if (pId) {
      const projectExists = projects.find(p => p.id === pId);
      if (projectExists) {
            if (aId) {
                const assetExists = projectExists.assets.find(a => a.id === aId);
                const shouldRestrict = currentUser.role === UserRole.GUEST; 
                if (assetExists) setView({ type: 'PLAYER', projectId: pId, assetId: aId, restrictedAssetId: shouldRestrict ? aId : undefined });
                else setView({ type: 'PROJECT_VIEW', projectId: pId });
            } else {
                setView({ type: 'PROJECT_VIEW', projectId: pId });
            }
      } else {
          processInviteLink(currentUser, pId, aId);
      }
    }
  }, [currentUser]); 

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
    
    if (!skipSync && currentUser?.role !== UserRole.GUEST) {
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
    const newProjects = [newProject, ...projects];
    setProjects(newProjects);
    notify("Project created successfully", "success");
    forceSync(newProjects);
  };

  const handleDeleteProject = async (projectId: string) => {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      notify("Project deleted", "info");
      
      if ((view.type === 'PROJECT_VIEW' || view.type === 'PLAYER') && view.projectId === projectId) {
          handleBackToDashboard();
      }
  };

  // Called when user clicks "Login" in Clerk (handled by Clerk) OR "Guest Login"
  // Also called when "Mock Login" is triggered
  const handleGuestLogin = async (user: User, token?: string) => {
    // If we are in mock mode, this might be triggered by the manual guest form
    setGuestUser(user);
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(user));
    if (token) {
        localStorage.setItem(GUEST_TOKEN_KEY, token);
    }
    notify(`Welcome, ${user.name}`, "success");
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

  if (view.type === 'LIVE_DEMO') {
      return <LiveDemo onBack={() => handleNavigate('DASHBOARD')} />;
  }

  const currentProject = (view.type === 'PROJECT_VIEW' || view.type === 'PLAYER') ? projects.find(p => p.id === view.projectId) : null;
  const currentAsset = (view.type === 'PLAYER' && currentProject) ? currentProject.assets.find(a => a.id === view.assetId) : null;

  if (!currentUser) {
      const isPublicView = ['WORKFLOW', 'ABOUT', 'PRICING', 'AI_FEATURES'].includes(view.type);
      
      if (isPublicView) {
          return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-indigo-500/30 transition-colors">
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
                onLogin={isMockMode && mockSignIn ? () => mockSignIn() : handleGuestLogin} 
                onNavigate={handleNavigate} 
            />
            {isMockMode && (
                <div className="fixed bottom-0 left-0 right-0 bg-yellow-500/90 text-black text-center text-xs font-bold py-1 z-[100] backdrop-blur-sm">
                    PREVIEW MODE: Login to test (No real backend)
                </div>
            )}
        </>
      );
  }

  const isPlatformView = ['DASHBOARD', 'PROFILE', 'WORKFLOW', 'ABOUT', 'PRICING', 'AI_FEATURES'].includes(view.type);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-indigo-500/30 transition-colors">
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
          <ProjectView 
            project={currentProject} 
            currentUser={currentUser}
            onBack={handleBackToDashboard}
            onSelectAsset={handleSelectAsset}
            onUpdateProject={handleUpdateProject}
            notify={notify}
            restrictedAssetId={view.restrictedAssetId}
            isMockMode={isMockMode}
          />
        )}
        {view.type === 'PLAYER' && currentProject && currentAsset && (
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
        )}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        {isMockMode && (
            <div className="fixed bottom-0 left-0 right-0 bg-yellow-500/90 text-black text-center text-xs font-bold py-1 z-[100] backdrop-blur-sm pointer-events-none">
                PREVIEW MODE: Local Data Only
            </div>
        )}
      </main>
    </div>
  );
};

// --- AUTH WRAPPERS ---

const ClerkAuthWrapper = () => {
    const { user, isLoaded, isSignedIn } = useUser();
    const { signOut } = useClerk();
    const { getToken } = useAuth();
    
    return (
        <AppLayout 
            clerkUser={user} 
            isLoaded={isLoaded} 
            isSignedIn={isSignedIn || false} 
            getToken={getToken} 
            signOut={signOut}
            authMode="clerk"
        />
    );
};

const MockAuthWrapper = () => {
    // Manually manage mock login state
    const [mockUser, setMockUser] = useState<any>(() => {
        return sessionStorage.getItem('mock_auth_user') ? JSON.parse(sessionStorage.getItem('mock_auth_user')!) : null;
    });

    const mockSignIn = () => {
        const user = { id: 'mock-dev', fullName: 'Developer', imageUrl: '' };
        sessionStorage.setItem('mock_auth_user', JSON.stringify(user));
        setMockUser(user);
    };

    const mockSignOut = async () => {
        sessionStorage.removeItem('mock_auth_user');
        setMockUser(null);
    };

    const mockGetToken = async () => null;

    return (
        <AppLayout 
            clerkUser={mockUser} 
            isLoaded={true} 
            isSignedIn={!!mockUser} 
            getToken={mockGetToken} 
            signOut={mockSignOut}
            mockSignIn={mockSignIn}
            authMode="mock"
        />
    );
};

const App: React.FC = () => {
  // Check for Valid Clerk Key
  const env = (import.meta as any).env || {};
  const PUBLISHABLE_KEY = env.VITE_CLERK_PUBLISHABLE_KEY || "";
  const isValidKey = PUBLISHABLE_KEY && !PUBLISHABLE_KEY.includes("placeholder");

  return (
    <ThemeProvider>
      <LanguageProvider>
          {isValidKey ? (
              <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
                 <ClerkAuthWrapper />
              </ClerkProvider>
          ) : (
              // If Key is missing, use MockWrapper (dev/preview)
              <MockAuthWrapper />
          )}
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
