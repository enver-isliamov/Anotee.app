
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dashboard } from './components/Dashboard';
import { ProjectView } from './components/ProjectView';
import { Player } from './components/Player';
import { Login } from './components/Login';
import { Profile } from './components/Profile';
import { WorkflowPage, AboutPage, PricingPage, AiFeaturesPage } from './components/StaticPages';
import { LiveDemo } from './components/LiveDemo';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { Project, ProjectAsset, User, UserRole, StorageType, UploadTask } from './types';
import { generateId, generateVideoThumbnail } from './services/utils';
import { LanguageProvider, LanguageCloudSync } from './services/i18n';
import { ThemeProvider, ThemeCloudSync } from './services/theme';
import { MainLayout } from './components/MainLayout';
import { GoogleDriveService } from './services/googleDrive';
import { useUser, useClerk, useAuth, ClerkProvider } from '@clerk/clerk-react';
import { api } from './services/apiClient';
import { Loader2, UploadCloud, X, CheckCircle, AlertCircle } from 'lucide-react';
import { upload } from '@vercel/blob/client';

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

const POLLING_INTERVAL_MS = 10000; // Increased to 10s for stability and quota savings

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
}

const AppLayout: React.FC<AppLayoutProps> = ({ clerkUser, isLoaded, isSignedIn, getToken, signOut, mockSignIn, authMode }) => {
  const isMockMode = authMode === 'mock';
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<ViewState>({ type: 'DASHBOARD' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);

  // Track the last local modification to prevent server overwrites
  const lastLocalUpdateRef = useRef<number>(0);

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
        setCurrentUser({
            id: clerkUser.id,
            name: clerkUser.fullName || clerkUser.firstName || 'Developer',
            avatar: clerkUser.imageUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev',
            role: UserRole.ADMIN 
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

  // --- GLOBAL UPLOAD HANDLER ---
  const handleUploadAsset = async (file: File, projectId: string, useDrive: boolean, targetAssetId?: string) => {
      const taskId = generateId();
      
      // Get FRESH project reference from current state or API, but we use state here for speed
      // Using functional state access inside setProjects is safer for consistency
      
      const newTask: UploadTask = {
          id: taskId,
          file,
          projectName: 'Uploading...', // Placeholder
          progress: 0,
          status: 'uploading'
      };

      setUploadTasks(prev => [...prev, newTask]);

      const updateTask = (updates: Partial<UploadTask>) => {
          setUploadTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
      };

      try {
          // Block server polling to prevent overwriting
          lastLocalUpdateRef.current = Date.now() + 60000; // Block for 1 min or until done

          // 1. Generate Thumbnail
          updateTask({ status: 'processing' });
          const thumbnailDataUrl = await generateVideoThumbnail(file);
          const assetTitle = file.name.replace(/\.[^/.]+$/, "");
          
          // Find Project Name for UI
          const project = projects.find(p => p.id === projectId);
          if (project) updateTask({ projectName: project.name });

          updateTask({ status: 'uploading' });

          let assetUrl = '';
          let googleDriveId = undefined;
          let storageType: StorageType = 'vercel';
          let finalFileName = file.name;
          const token = localStorage.getItem('smotree_auth_token');

          // 2. Upload Process
          if (isMockMode) {
              for (let i = 0; i <= 100; i+=10) {
                  updateTask({ progress: i });
                  await new Promise(r => setTimeout(r, 200));
              }
              assetUrl = URL.createObjectURL(file);
              storageType = 'local';
          } else {
              if (useDrive) {
                  const isDriveReady = GoogleDriveService.isAuthenticated();
                  if (!isDriveReady) throw new Error("Google Drive not connected");

                  // Re-fetch project name if needed to ensure folders
                  const safeProjectName = project ? project.name : "Unknown Project";

                  const appFolder = await GoogleDriveService.ensureAppFolder();
                  const projectFolder = await GoogleDriveService.ensureFolder(safeProjectName, appFolder);
                  const assetFolder = await GoogleDriveService.ensureFolder(assetTitle, projectFolder);

                  const ext = file.name.split('.').pop();
                  const niceName = targetAssetId 
                        ? `${assetTitle}_vNEW.${ext}`
                        : `${assetTitle}_v1.${ext}`;

                  const result = await GoogleDriveService.uploadFile(file, assetFolder, (p) => updateTask({ progress: p }), niceName);
                  googleDriveId = result.id;
                  storageType = 'drive';
                  finalFileName = niceName;
              } else {
                  // Vercel Blob
                  const newBlob = await upload(file.name, file, {
                      access: 'public',
                      handleUploadUrl: '/api/upload',
                      clientPayload: JSON.stringify({ token: token, user: currentUser?.id || 'anon' }),
                      onUploadProgress: (p) => updateTask({ progress: Math.round((p.loaded / p.total) * 100) })
                  });
                  assetUrl = newBlob.url;
              }
          }

          // 3. Update State & DB
          setProjects(currentProjects => {
              const projIndex = currentProjects.findIndex(p => p.id === projectId);
              if (projIndex === -1) return currentProjects;

              const updatedProject = { ...currentProjects[projIndex] };
              
              // 3.1 Construct New Version Object
              const newVersion = {
                  id: generateId(),
                  versionNumber: 1, 
                  filename: finalFileName,
                  url: assetUrl,
                  storageType,
                  googleDriveId,
                  uploadedAt: 'Just now',
                  comments: [],
                  localFileUrl: isMockMode ? URL.createObjectURL(file) : undefined,
                  localFileName: isMockMode ? file.name : undefined
              };

              // 3.2 Insert into Assets
              if (targetAssetId) {
                  // Adding Version
                  const assetIdx = updatedProject.assets.findIndex(a => a.id === targetAssetId);
                  if (assetIdx !== -1) {
                      const asset = { ...updatedProject.assets[assetIdx] };
                      newVersion.versionNumber = asset.versions.length + 1;
                      
                      // Fix name for non-mock drive uploads if needed
                      if (!isMockMode && useDrive) {
                          newVersion.filename = `${asset.title}_v${newVersion.versionNumber}.${file.name.split('.').pop()}`;
                      }
                      
                      asset.versions = [...asset.versions, newVersion];
                      asset.thumbnail = thumbnailDataUrl; // Update thumb to latest
                      asset.currentVersionIndex = asset.versions.length - 1;
                      updatedProject.assets[assetIdx] = asset;
                  }
              } else {
                  // New Asset
                  const newAsset: ProjectAsset = {
                      id: generateId(),
                      title: assetTitle,
                      thumbnail: thumbnailDataUrl,
                      currentVersionIndex: 0,
                      versions: [newVersion]
                  };
                  updatedProject.assets = [...updatedProject.assets, newAsset];
              }
              
              updatedProject.updatedAt = 'Just now';
              
              // 3.3 Trigger Sync (Outside logic, but inside closure scope we need the obj)
              // We execute the API call safely here without blocking the UI render
              setTimeout(() => {
                  api.syncProjects([updatedProject], currentUser, null).catch(console.error);
                  lastLocalUpdateRef.current = Date.now(); // Reset block to allow polling after a moment
              }, 0);

              const newAllProjects = [...currentProjects];
              newAllProjects[projIndex] = updatedProject;
              
              return newAllProjects;
          });

          updateTask({ status: 'done', progress: 100 });
          notify("Upload completed", "success");

      } catch (e: any) {
          console.error("Upload failed", e);
          updateTask({ status: 'error', error: e.message || "Upload Failed" });
          notify("Upload failed", "error");
          lastLocalUpdateRef.current = Date.now(); // Unblock polling
      }
  };

  const removeUploadTask = (id: string) => {
      setUploadTasks(prev => prev.filter(t => t.id !== id));
  };

  const fetchCloudData = useCallback(async (userOverride?: User) => {
      const userToUse = userOverride || currentUser;
      if (!userToUse) return;
      
      // --- STABILITY FIX: Don't fetch if we just modified data locally ---
      if (Date.now() - lastLocalUpdateRef.current < 2000) {
          // console.log("Skipping poll due to recent local update");
          return;
      }

      let token: string | null = null;
      if (authMode === 'clerk') {
          try { token = await getToken(); } catch (e) {}
      }

      try {
         setIsSyncing(true);
         const data = await api.getProjects(userToUse, token);
         if (data && Array.isArray(data)) {
            // Merge strategy: Only update if server has newer data, or just replace
            // For simplicity, we replace, but relying on `lastLocalUpdateRef` to prevent overwriting user actions
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
      
      // Update timestamp to prevent immediate overwrite by polling
      lastLocalUpdateRef.current = Date.now();

      let token: string | null = null;
      if (authMode === 'clerk') try { token = await getToken(); } catch(e) {}

      try {
          setIsSyncing(true);
          await api.syncProjects(projectsData, currentUser, token);
      } catch (e) {
          console.error("Sync failed", e);
          notify("Failed to save changes to cloud. Check internet.", "error");
      } finally {
          setIsSyncing(false);
      }
  };

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

  // Deep Linking for Navigation
  useEffect(() => {
    if (!currentUser) return;

    const params = new URLSearchParams(window.location.search);
    const pId = params.get('projectId');
    const aId = params.get('assetId');

    if (pId) {
      // Optimistic check in current list
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

  // --- PREVENT FLICKERING (LOADING STATE) ---
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
        
        {/* GLOBAL COMPONENTS */}
        <UploadWidget tasks={uploadTasks} onClose={removeUploadTask} />
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        
        {isMockMode && (
            <div className="fixed bottom-0 left-0 right-0 bg-yellow-500/90 text-black text-center text-xs font-bold py-1 z-[100] pointer-events-none">
                PREVIEW MODE: Local Data Only
            </div>
        )}
      </main>
    </div>
  );
};

const ClerkAuthWrapper = () => {
    const { user, isLoaded, isSignedIn } = useUser();
    const { signOut } = useClerk();
    const { getToken } = useAuth();
    
    return (
        <>
            <ThemeCloudSync />
            <LanguageCloudSync />
            <AppLayout 
                clerkUser={user} 
                isLoaded={isLoaded} 
                isSignedIn={isSignedIn || false} 
                getToken={getToken} 
                signOut={signOut}
                authMode="clerk"
            />
        </>
    );
};

const MockAuthWrapper = () => {
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
              <MockAuthWrapper />
          )}
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
