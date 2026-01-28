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
import { MOCK_PROJECTS } from './constants';
import { generateId } from './services/utils';
import { LanguageProvider } from './services/i18n';
import { ThemeProvider } from './services/theme';
import { MainLayout } from './components/MainLayout';
import { GoogleDriveService } from './services/googleDrive';
import { useUser, useSession, useClerk, useAuth } from '@clerk/clerk-react';

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

const STORAGE_KEY = 'smotree_projects_data';
const GUEST_STORAGE_KEY = 'smotree_guest_user'; // Renamed to clarify it's only for guests
const POLLING_INTERVAL_MS = 5000;

const AppContent: React.FC = () => {
  // Clerk Hooks
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { session } = useSession();
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  // Local Guest User State
  const [guestUser, setGuestUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(GUEST_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  });

  // Derived Current User
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : MOCK_PROJECTS;
  });

  const [view, setView] = useState<ViewState>({ type: 'DASHBOARD' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const isRemoteUpdate = useRef(false);
  const isJoiningFlow = useRef(false);
  const offlineModeNotified = useRef(false);
  const processedInvites = useRef<Set<string>>(new Set()); 

  // --- SYNC AUTH STATE ---
  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && clerkUser) {
        // Authenticated via Clerk
        setCurrentUser({
            id: clerkUser.primaryEmailAddress?.emailAddress || clerkUser.id,
            name: clerkUser.fullName || 'User',
            avatar: clerkUser.imageUrl,
            role: UserRole.ADMIN // Clerk users are always Admins/Creators
        });
        // Clear local guest if we logged in fully
        if (guestUser) {
            setGuestUser(null);
            localStorage.removeItem(GUEST_STORAGE_KEY);
        }
    } else if (guestUser) {
        // Fallback to Guest
        setCurrentUser(guestUser);
    } else {
        setCurrentUser(null);
    }
  }, [isLoaded, isSignedIn, clerkUser, guestUser]);

  // --- CONFIGURE GOOGLE DRIVE SERVICE ---
  useEffect(() => {
    if (isSignedIn) {
        GoogleDriveService.setTokenProvider(async () => {
            try {
                // 1. Get the Clerk JWT for the backend call
                const clerkToken = await getToken();
                if (!clerkToken) return null;

                // 2. Call our backend to get the Google Drive Token
                const res = await fetch('/api/driveToken', {
                    headers: { 'Authorization': `Bearer ${clerkToken}` }
                });

                if (res.ok) {
                    const data = await res.json();
                    return data.token; // Returns Google OAuth Access Token
                }
                return null;
            } catch (e) {
                console.error("Failed to retrieve Drive Token", e);
                return null;
            }
        });
    } else {
        GoogleDriveService.setTokenProvider(async () => null);
    }
  }, [isSignedIn, getToken]);


  // TOAST HANDLER
  const notify = (message: string, type: ToastType = 'info') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const getAuthHeader = async (overrideUser?: User): Promise<Record<string, string>> => {
     // If Clerk user, get JWT
     if (isSignedIn) {
         try {
             const token = await getToken();
             if (token) return { 'Authorization': `Bearer ${token}` };
         } catch(e) {}
     }
     
     // Fallback to Guest header
     const targetUser = overrideUser || currentUser;
     if (targetUser) return { 'X-Guest-ID': targetUser.id };
     return {};
  };

  const handleLogout = async () => {
    if (isSignedIn) {
        await signOut();
    } else {
        setGuestUser(null);
        localStorage.removeItem(GUEST_STORAGE_KEY);
    }
    setView({ type: 'DASHBOARD' });
    window.history.pushState({}, '', window.location.pathname);
  };

  const fetchCloudData = useCallback(async (userOverride?: User) => {
      const userToUse = userOverride || currentUser;
      if (!userToUse) return;

       try {
         setIsSyncing(true);
         const headers = await getAuthHeader(userToUse);
         
         const res = await fetch('/api/data', { headers });
         
         if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data)) {
                isRemoteUpdate.current = true;
                setProjects(data);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
                offlineModeNotified.current = false;
            }
         } else if (res.status === 503) {
             if (!offlineModeNotified.current) {
                console.warn("Backend 503: Offline Mode active");
             }
         }
       } catch (e) {
         // Silent fail on fetch
       } finally {
         setIsSyncing(false);
       }
  }, [currentUser, isSignedIn, getToken]);

  const sanitizeProjectsForCloud = (projectsList: Project[]): Project[] => {
      return projectsList.map(p => ({
          ...p,
          assets: p.assets.map(a => ({
              ...a,
              versions: a.versions.map(v => {
                  const cleanVersion = { ...v };
                  delete cleanVersion.localFileUrl;
                  delete cleanVersion.localFileName;
                  return cleanVersion;
              })
          }))
      }));
  };

  const forceSync = async (projectsData: Project[], isRetry = false) => {
      if (!currentUser || currentUser.role === UserRole.GUEST) return;
      
      const cleanData = sanitizeProjectsForCloud(projectsData);

      try {
          setIsSyncing(true);
          const headers = await getAuthHeader();
          const res = await fetch('/api/data', {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  ...headers
              },
              body: JSON.stringify(cleanData)
          });
          
          if (!res.ok) {
             if (res.status === 503) {
                 if (!offlineModeNotified.current) {
                     notify("Offline Mode: Cloud DB disconnected. Changes saved locally.", "info");
                     offlineModeNotified.current = true;
                 }
                 return;
             }

             if (!isRetry && res.status !== 404 && res.status !== 500) {
                 try {
                     const setupRes = await fetch('/api/setup');
                     if (setupRes.ok) {
                        await forceSync(projectsData, true);
                        return;
                     }
                 } catch (setupError) {
                     console.error("Auto-repair failed", setupError);
                 }
             }
          } else {
             if (offlineModeNotified.current) {
                 notify("Online: Cloud Sync Restored", "success");
                 offlineModeNotified.current = false;
             }
          }
      } catch (e) {
          console.error("Force sync network error", e);
      } finally {
          setIsSyncing(false);
      }
  };

  useEffect(() => {
    if (!currentUser || isJoiningFlow.current) return; 
    fetchCloudData();
  }, [currentUser, fetchCloudData]);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(async () => {
        if (isSyncing || isJoiningFlow.current) return;
        try {
            const headers = await getAuthHeader();
            const res = await fetch('/api/data', { headers });
            if (res.ok) {
                const cloudData = await res.json();
                if (cloudData && Array.isArray(cloudData)) {
                    setProjects(prevCurrent => {
                        const cleanPrev = sanitizeProjectsForCloud(prevCurrent);
                        if (JSON.stringify(cleanPrev) !== JSON.stringify(cloudData)) {
                            isRemoteUpdate.current = true;
                            return cloudData;
                        }
                        return prevCurrent;
                    });
                }
            }
        } catch (e) {}
    }, POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isSyncing, currentUser, isSignedIn, getToken]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [projects]);

  const processInviteLink = async (user: User, projectId: string, assetId?: string | null) => {
      if (processedInvites.current.has(projectId)) return; 
      
      console.log(`🔗 Processing invite for project: ${projectId}`);
      isJoiningFlow.current = true;
      notify("Accepting invitation...", "info");

      try {
          const joinRes = await fetch('/api/join', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectId: projectId, user: user })
          });
          
          if (joinRes.ok) {
              const joinData = await joinRes.json();
              if (joinData.project) {
                  processedInvites.current.add(projectId);
                  isRemoteUpdate.current = true;
                  setProjects(prev => {
                      const exists = prev.some(p => p.id === joinData.project.id);
                      if (exists) return prev.map(p => p.id === joinData.project.id ? joinData.project : p);
                      return [joinData.project, ...prev]; 
                  });
                  notify(`You joined "${joinData.project.name}"`, "success");
                  
                  if (assetId) {
                      setView({ type: 'PLAYER', projectId: projectId, assetId: assetId, restrictedAssetId: assetId });
                  } else {
                      setView({ type: 'PROJECT_VIEW', projectId: projectId });
                  }
                  
                  const url = new URL(window.location.href);
                  url.searchParams.delete('projectId');
                  if (assetId) url.searchParams.delete('assetId');
                  window.history.replaceState({}, '', url.toString());
              }
          } else {
               notify("Failed to join project.", "error");
          }
      } catch (e) {
          console.error("Join flow error:", e);
          notify("Network error joining project.", "error");
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
          // If viewing specific asset via link
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
      
      // Cleanup logic removed for brevity in this snippet
      if ((view.type === 'PROJECT_VIEW' || view.type === 'PLAYER') && view.projectId === projectId) {
          handleBackToDashboard();
      }
  };

  const handleGuestLogin = async (user: User) => {
    setGuestUser(user);
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(user));
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
            </div>
          );
      }
      
      return <Login onLogin={handleGuestLogin} onNavigate={handleNavigate} />;
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
          />
        )}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
