
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Project, ProjectAsset, User, StorageType, UploadTask } from '../types';
import { ChevronLeft, Upload, Clock, Loader2, Copy, Check, X, Clapperboard, ChevronRight, Link as LinkIcon, Trash2, UserPlus, Info, History, Lock, Cloud, HardDrive, AlertTriangle, Shield, Eye, FileVideo, Unlock, Globe, Building2, User as UserIcon, Settings, AlertCircle, Plus, Server, Crown, EyeOff } from 'lucide-react';
import { generateId } from '../services/utils';
import { ToastType } from './Toast';
import { LanguageSelector } from './LanguageSelector';
import { useLanguage } from '../services/i18n';
import { GoogleDriveService } from '../services/googleDrive';
import { api } from '../services/apiClient';
import { useOrganization, OrganizationProfile, useAuth } from '@clerk/clerk-react';
import { useDrive } from '../services/driveContext';
import { mapClerkUserToAppUser, isOrgAdmin } from '../services/userUtils';
import logo from '../logo.svg';
import { useSubscription } from '../hooks/useSubscription';
import { useAppConfig } from '../hooks/useAppConfig';

interface ProjectViewProps {
  project: Project;
  currentUser: User;
  onBack: () => void;
  onSelectAsset: (asset: ProjectAsset) => void;
  onUpdateProject: (project: Project) => void;
  notify: (msg: string, type: ToastType) => void;
  restrictedAssetId?: string;
  isMockMode?: boolean;
  onUploadAsset: (file: File, projectId: string, useDrive: boolean, targetAssetId?: string) => Promise<void>;
  onboardingActiveStep?: number;
  uploadTasks: UploadTask[]; 
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project, currentUser, onBack, onSelectAsset, onUpdateProject, notify, restrictedAssetId, isMockMode = false, onUploadAsset, uploadTasks }) => {
  const { t } = useLanguage();
  const { isPro } = useSubscription();
  const { config } = useAppConfig();
  const { getToken } = useAuth();
  
  // --- CLERK ORGANIZATION LOGIC ---
  const { organization, memberships } = useOrganization({
      memberships: { infinite: true }
  });

  // Calculate the "Display Team"
  const displayTeam: User[] = useMemo(() => {
      if (project.orgId && organization && memberships?.data) {
          return memberships.data.map(mapClerkUserToAppUser);
      }
      return project.team || [];
  }, [project.orgId, organization, memberships, project.team]);

  const isAdmin = useMemo(() => {
      if (!organization || !memberships?.data) return false;
      return isOrgAdmin(currentUser.id, memberships.data);
  }, [organization, memberships, currentUser.id]);

  const isProjectMember = project.orgId 
        ? displayTeam.some(m => m.id === currentUser.id)
        : (project.team?.some(m => m.id === currentUser.id) || false);
        
  const isProjectOwner = project.ownerId === currentUser.id;
  
  // DETERMINE RESTRICTED STATUS
  // Check if current user is restricted in the team list
  const isRestrictedUser = useMemo(() => {
      const me = project.team?.find(m => m.id === currentUser.id);
      return !!me?.restrictedAssetId;
  }, [project.team, currentUser.id]);

  // If passed as prop (URL param) OR deduced from DB data
  const effectiveRestrictedId = restrictedAssetId || (isRestrictedUser ? project.assets[0]?.id : undefined);

  const canEditProject = (isProjectOwner || isProjectMember) && !isRestrictedUser;
  const canDeleteAssets = (isProjectOwner || isAdmin || (isProjectMember && project.orgId)) && !isRestrictedUser;
  const isLocked = project.isLocked;

  // SHARE PERMISSION CHECKS (Granular)
  const canInviteTeam = isPro ? config.sharing_project.enabledForPro : config.sharing_project.enabledForFree;
  const canSharePublicLink = isPro ? config.sharing_public_link.enabledForPro : config.sharing_public_link.enabledForFree;

  // Delete State
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean, asset: ProjectAsset | null }>({ isOpen: false, asset: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const [uploadingVersionFor, setUploadingVersionFor] = useState<string | null>(null);
  
  // Use Context
  const { isDriveReady } = useDrive();
  
  // Share / Team View State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{type: 'project' | 'asset', id: string, name: string} | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  
  // Refactored Share Modal: Tabs
  const [shareTab, setShareTab] = useState<'invite' | 'public'>('public');
  const [isTogglingAccess, setIsTogglingAccess] = useState(false);

  // Org Settings Modal
  const [isOrgSettingsOpen, setIsOrgSettingsOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);

  // If restricted, we assume the backend already filtered the assets array. 
  // We double-check here just for UI consistency.
  const visibleAssets = isRestrictedUser 
    ? project.assets 
    : project.assets;

  // Find active uploads for this project
  const activeUpload = uploadTasks.find(t => t.projectName === project.name);

  // --- HANDLERS ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (!isMockMode && !isDriveReady) {
          notify("Google Drive is not connected. Upload disabled.", "error");
          return;
      }
      onUploadAsset(e.target.files[0], project.id, true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleVersionFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && uploadingVersionFor) {
        if (!isMockMode && !isDriveReady) {
            notify("Google Drive is not connected. Upload disabled.", "error");
            return;
        }
        onUploadAsset(e.target.files[0], project.id, true, uploadingVersionFor);
    }
    setUploadingVersionFor(null);
    if (versionInputRef.current) versionInputRef.current.value = '';
  };

  const confirmDeleteAsset = async (deleteFromDrive: boolean) => {
    const asset = deleteModalState.asset;
    if (!asset) return;

    setIsDeleting(true);

    try {
        if (!isMockMode) {
            if (deleteFromDrive) {
                // 1. DELETE FROM GOOGLE DRIVE
                if (isDriveReady) {
                    notify("Deleting files from Drive...", "info");
                    for (const v of asset.versions) {
                        if (v.storageType === 'drive' && v.googleDriveId) {
                            await GoogleDriveService.deleteFile(v.googleDriveId);
                        }
                    }
                }

                // 2. DELETE FROM S3
                const s3Keys = asset.versions
                    .filter(v => v.storageType === 's3' && v.s3Key)
                    .map(v => v.s3Key);
                
                if (s3Keys.length > 0) {
                    notify("Deleting files from S3...", "info");
                    try {
                        const token = await getToken();
                        await fetch('/api/storage?action=delete', {
                            method: 'POST',
                            headers: { 
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ keys: s3Keys })
                        });
                    } catch (e) {
                        console.error("Failed to delete from S3", e);
                    }
                }
            }

            // 3. DELETE FROM VERCEL BLOB (System)
            const urlsToDelete: string[] = [];
            asset.versions.forEach(v => {
                if (v.storageType === 'vercel' && v.url.startsWith('http')) {
                    urlsToDelete.push(v.url);
                }
            });

            if (urlsToDelete.length > 0) {
                await api.deleteAssets(urlsToDelete, project.id);
            }
        }

        const updatedAssets = project.assets.filter(a => a.id !== asset.id);
        onUpdateProject({ ...project, assets: updatedAssets });
        notify(t('common.success'), "success");

    } catch (e) {
        console.error(e);
        notify("Error during deletion", "error");
    } finally {
        setIsDeleting(false);
        setDeleteModalState({ isOpen: false, asset: null });
    }
  };

  const handleShareProject = () => {
    if (isLocked) return;
    if (!canInviteTeam && !project.orgId) {
        notify("Invite feature is locked. Upgrade to Pro.", "warning");
        return;
    }
    setShareTarget({ type: 'project', id: project.id, name: project.name });
    setShareTab('public'); // Default
    setIsShareModalOpen(true);
  };

  const handleShareAsset = (e: React.MouseEvent, asset: ProjectAsset) => {
    e.stopPropagation(); 
    if (isLocked) {
        notify(t('dash.locked_msg'), "error");
        return;
    }
    if (!canSharePublicLink) {
        notify("Public Links are locked. Upgrade to Pro.", "warning");
        return;
    }
    setShareTarget({ type: 'asset', id: asset.id, name: asset.title });
    setIsShareModalOpen(true);
  };

  const handleAddVersionClick = (e: React.MouseEvent, assetId: string) => {
      e.stopPropagation();
      if (!isMockMode && !isDriveReady) {
          notify("Connect Drive to upload new versions", "warning");
          return;
      }
      setUploadingVersionFor(assetId);
      setTimeout(() => versionInputRef.current?.click(), 0);
  };

  const handleFixPermissions = async (e: React.MouseEvent, driveId: string) => {
      e.stopPropagation();
      notify("Attempting to make file public...", "info");
      const success = await GoogleDriveService.makeFilePublic(driveId);
      if (success) notify("Success! File is now public.", "success");
      else notify("Failed. Check Google Workspace settings.", "error");
  };

  const togglePublicAccess = async () => {
      setIsTogglingAccess(true);
      const newAccess = project.publicAccess === 'view' ? 'none' : 'view';
      if (!isMockMode) {
          try {
              await api.patchProject(project.id, { publicAccess: newAccess }, project._version || 0);
          } catch(e) {
              notify("Failed to update settings", "error");
              setIsTogglingAccess(false);
              return;
          }
      }
      onUpdateProject({ ...project, publicAccess: newAccess });
      notify(newAccess === 'view' ? "Link access enabled" : "Link access disabled", "info");
      setIsTogglingAccess(false);
  };

  const handleInviteUser = async () => {
      if (!inviteEmail.trim()) return;
      if (!inviteEmail.includes('@')) {
          notify("Invalid email format", "error");
          return;
      }

      const newMember: User = {
          id: inviteEmail, 
          name: inviteEmail.split('@')[0],
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${inviteEmail}`
      };

      const currentTeam = project.team || [];
      if (currentTeam.some(m => m.id === newMember.id || (m as any).email === inviteEmail)) {
          notify("User already in team", "warning");
          return;
      }

      const newTeam = [...currentTeam, { ...newMember, email: inviteEmail }]; 
      
      if (!isMockMode) {
          try {
              await api.patchProject(project.id, { team: newTeam }, project._version || 0);
          } catch (e) {
              notify("Failed to invite user", "error");
              return;
          }
      }
      
      onUpdateProject({ ...project, team: newTeam });
      setInviteEmail('');
      notify("User added to project", "success");
  };

  const handleRemoveUser = async (userId: string) => {
      if (!confirm("Remove user from project?")) return;
      const newTeam = (project.team || []).filter(m => m.id !== userId);
      if (!isMockMode) {
          try {
              await api.patchProject(project.id, { team: newTeam }, project._version || 0);
          } catch (e) {
              notify("Failed to remove user", "error");
              return;
          }
      }
      onUpdateProject({ ...project, team: newTeam });
      notify("User removed", "info");
  };

  const handleCopyLink = () => {
    const origin = window.location.origin;
    let url = '';
    
    if (shareTarget?.type === 'project') {
       if (shareTab === 'invite') {
           url = `${origin}?projectId=${shareTarget.id}&invite=true`;
       } else {
           url = `${origin}?projectId=${shareTarget.id}`;
       }
    } else {
       // Review Link: Explicitly limit to asset
       url = `${origin}?projectId=${project.id}&assetId=${shareTarget?.id}`;
    }
    
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    notify(t('common.link_copied'), "success");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const getDisplayRole = (member: User) => {
      if (member.id === project.ownerId) return t('pv.role.owner');
      return t('pv.role.creator');
  };

  // Handler for Org Invite click
  const handleOrgInviteClick = () => {
      // Close share modal if open
      setIsShareModalOpen(false);
      // Open Clerk Org Settings
      setIsOrgSettingsOpen(true);
  };

  // --- INLINE UPLOAD TILE COMPONENT ---
  const UploadZoneTile = () => {
      const [isDragOver, setIsDragOver] = useState(false);
      const isProcessing = activeUpload && activeUpload.status !== 'done' && activeUpload.status !== 'error';

      const onDragOver = (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          if (canEditProject && !isLocked) setIsDragOver(true);
      };

      const onDragLeave = (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);
      };

      const onDrop = (e: React.DragEvent) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragOver(false);

          if (!canEditProject || isLocked) return;
          if (!isMockMode && !isDriveReady) {
              notify("Google Drive is not connected. Upload disabled.", "error");
              return;
          }

          const files = Array.from(e.dataTransfer.files) as File[];
          const videoFiles = files.filter(f => f.type.startsWith('video/'));
          
          if (videoFiles.length === 0) {
              if (files.length > 0) notify("Only video files supported", "warning");
              return;
          }
          onUploadAsset(videoFiles[0], project.id, true);
      };

      const handleClick = () => {
          if (!canEditProject || isLocked) return;
          if (!isMockMode && !isDriveReady) {
              notify("Google Drive is not connected. Upload disabled.", "error");
              return;
          }
          fileInputRef.current?.click();
      };

      // Styling
      let borderClass = 'border-zinc-300 dark:border-zinc-800 hover:border-indigo-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50';
      if (isDragOver) borderClass = 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.02]';
      if (isProcessing) borderClass = 'border-indigo-500/50 bg-zinc-50 dark:bg-zinc-900 cursor-default';

      if (!canEditProject || isLocked) return null;

      return (
          <div 
            id="tour-upload-zone"
            onClick={!isProcessing ? handleClick : undefined}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer group relative overflow-hidden ${borderClass}`}
          >
              {isProcessing ? (
                  <div className="flex flex-col items-center gap-3 w-full px-4">
                      <Loader2 className="animate-spin text-indigo-500" size={32} />
                      <div className="w-full text-center">
                          <div className="text-xs font-bold text-zinc-900 dark:text-white truncate mb-1">{activeUpload.file.name}</div>
                          <div className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${activeUpload.progress}%` }}></div>
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-1 uppercase font-bold">{activeUpload.progress}% Uploading</div>
                      </div>
                  </div>
              ) : (
                  <>
                      <div className={`p-3 rounded-full mb-3 transition-transform ${isDragOver ? 'bg-indigo-100 text-indigo-600 scale-110' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 group-hover:text-indigo-500 group-hover:scale-110'}`}>
                          <Plus size={24} />
                      </div>
                      <h3 className="font-bold text-zinc-600 dark:text-zinc-400 text-sm">{isDragOver ? 'Drop to Upload' : t('pv.upload_asset')}</h3>
                      <p className="text-[10px] text-zinc-400 mt-1">Drag & Drop or Click</p>
                  </>
              )}
          </div>
      );
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-950 relative">
      <header className="h-14 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-2 md:px-4 shrink-0 z-20">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white shrink-0 p-1 mr-1">
              <img src={logo} alt="Back" className="w-8 h-8 shrink-0 hover:opacity-80 transition-opacity" />
          </button>
          <div className="flex flex-col truncate">
            <span className="font-bold text-xs text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                Anotee <span className="text-zinc-600">/</span> <span className="cursor-pointer hover:text-zinc-200 transition-colors" onClick={onBack}>{t('nav.dashboard')}</span>
            </span>
            <div className="flex items-center gap-2 font-semibold text-sm md:text-base leading-tight text-zinc-100 truncate">
               <span className="truncate">{project.name}</span>
               {isLocked && <Lock size={12} className="text-red-500" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <LanguageSelector />
          
          {/* TEAM AVATARS - Hidden for Restricted Users */}
          {!isRestrictedUser && (
            <div 
              onClick={() => setIsParticipantsModalOpen(true)}
              className="flex -space-x-2 cursor-pointer hover:opacity-80 transition-opacity ml-2"
              title={t('pv.team')}
            >
              {displayTeam.slice(0, 3).map((member) => (
                  <img key={member.id} src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full border-2 border-zinc-950" />
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-zinc-950 bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400">
                {displayTeam.length > 3 ? `+${displayTeam.length - 3}` : '+'}
              </div>
            </div>
          )}

          {/* PERSONAL PROJECT INDICATOR */}
          {!isRestrictedUser && !project.orgId && (
             <div 
                id="tour-context-badge"
                className="hidden md:flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-md border border-zinc-700 text-zinc-400 cursor-help" title="Personal Workspace"
             >
                 <UserIcon size={12} />
                 <span className="text-[10px] font-medium uppercase tracking-wider">Personal</span>
             </div>
          )}

          {!isLocked && !isRestrictedUser && (
            <>
              <div className="h-6 w-px bg-zinc-800 mx-1"></div>
              {project.orgId ? (
                  <button 
                    onClick={handleOrgInviteClick}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs md:text-sm font-medium"
                    title="Manage Organization Members"
                  >
                    <UserPlus size={16} />
                    <span className="hidden md:inline">Manage Team</span>
                  </button>
              ) : (
                  <button 
                    id="tour-share-btn"
                    onClick={handleShareProject}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-xs md:text-sm font-medium ${canInviteTeam ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-70'}`}
                    title={canInviteTeam ? "Invite via Email" : "Invites are locked (Pro)"}
                    disabled={!canInviteTeam}
                  >
                    <UserPlus size={16} />
                    <span className="hidden md:inline">{t('pv.invite')}</span>
                  </button>
              )}
            </>
          )}
        </div>
      </header>
      
      {isLocked && (
          <div className="bg-red-900/20 border-b border-red-900/30 text-red-400 text-xs py-1 text-center font-medium flex items-center justify-center gap-2">
              <Lock size={12} />
              {t('pv.locked_banner')}
          </div>
      )}

      {isRestrictedUser && (
        <div className="bg-orange-900/20 border-b border-orange-900/30 text-orange-400 text-xs py-1 text-center font-medium flex items-center justify-center gap-2">
            <Info size={12} />
            Review Mode: Access limited to specific assets.
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-[1600px] mx-auto">
            {/* Asset Grid */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm md:text-base font-semibold text-zinc-200">{t('pv.assets')} <span className="text-zinc-500 ml-1">{visibleAssets.length}</span></h2>
                
                {canEditProject && !isLocked && (
                    <div className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileSelect} disabled={!isMockMode && !isDriveReady}/>
                    <input type="file" ref={versionInputRef} className="hidden" accept="video/*" onChange={handleVersionFileSelect} disabled={!isMockMode && !isDriveReady}/>
                    
                    {/* Storage Status Indicator - Only visible in Prod */}
                    {!isMockMode && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${isDriveReady ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-red-900/20 text-red-400 border-red-800'}`} title={isDriveReady ? "Google Drive Connected" : "Please connect Google Drive in Profile"}>
                            {isDriveReady ? <HardDrive size={14} /> : <AlertCircle size={14} />}
                            <span className="hidden md:inline">{isDriveReady ? "Drive Ready" : "Drive Disconnected"}</span>
                        </div>
                    )}

                    {/* Mock Mode Indicator */}
                    {isMockMode && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-900/30 text-purple-400 border border-purple-800">
                            <Cloud size={14} />
                            <span className="hidden md:inline">Local Mode</span>
                        </div>
                    )}
                    </div>
                )}
            </div>

            <div id="tour-assets-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {/* NEW INLINE UPLOAD TILE - Always First */}
                <UploadZoneTile />

                {visibleAssets.map((asset) => {
                    const lastVer = asset.versions[asset.versions.length-1];
                    const isDrive = lastVer?.storageType === 'drive';
                    const isS3 = lastVer?.storageType === 's3';
                    
                    return (
                    <div 
                        key={asset.id}
                        onClick={() => onSelectAsset(asset)}
                        className="group cursor-pointer bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-indigo-500/50 transition-all shadow-sm relative"
                    >
                        <div className="aspect-video bg-zinc-950 relative overflow-hidden">
                        <img 
                            src={asset.thumbnail} 
                            alt={asset.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80'; }}
                        />
                        {isDrive && <div className="absolute top-2 left-2 z-10 bg-black/60 text-green-400 p-1 rounded backdrop-blur-sm"><HardDrive size={10} /></div>}
                        {isS3 && <div className="absolute top-2 left-2 z-10 bg-black/60 text-indigo-400 p-1 rounded backdrop-blur-sm"><Server size={10} /></div>}
                        
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                            {!isLocked && canSharePublicLink && (
                                <button 
                                    onClick={(e) => handleShareAsset(e, asset)}
                                    className="p-1.5 bg-black/60 hover:bg-orange-500 text-white rounded-md backdrop-blur-sm transition-colors"
                                    title="Copy Review Link (Restricted Access)"
                                >
                                    <LinkIcon size={12} />
                                </button>
                            )}
                            {canEditProject && !isLocked && (
                                <>
                                    {isProjectOwner && isDrive && lastVer.googleDriveId && (
                                        <button onClick={(e) => handleFixPermissions(e, lastVer.googleDriveId!)} className="p-1.5 bg-black/60 hover:bg-yellow-500 text-white rounded-md"><Unlock size={12} /></button>
                                    )}
                                    <button onClick={(e) => handleAddVersionClick(e, asset.id)} className="p-1.5 bg-black/60 hover:bg-blue-500 text-white rounded-md"><History size={12} /></button>
                                    {canDeleteAssets && (
                                        <button onClick={(e) => { e.stopPropagation(); setDeleteModalState({ isOpen: true, asset: asset }); }} className="p-1.5 bg-black/60 hover:bg-red-500 text-white rounded-md"><Trash2 size={12} /></button>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white font-mono backdrop-blur-sm">v{asset.versions.length}</div>
                        </div>
                        <div className="p-3">
                        <h3 className="font-medium text-zinc-200 text-xs md:text-sm truncate mb-1">{asset.title}</h3>
                        <div className="flex justify-between items-center text-[10px] text-zinc-500">
                            <span className="flex items-center gap-1"><Clock size={10} />{asset.versions[asset.versions.length-1]?.comments.length}</span>
                            <span>{asset.versions[asset.versions.length-1]?.uploadedAt}</span>
                        </div>
                        </div>
                    </div>
                )})}
            </div>
          </div>
      </div>

      {/* DELETE MODAL */}
      {deleteModalState.isOpen && deleteModalState.asset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                  <div className="flex items-center gap-3 mb-4 text-red-500">
                      <AlertTriangle size={32} />
                      <h3 className="text-lg font-bold text-white">Delete Asset?</h3>
                  </div>
                  <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                      You are about to delete <strong>{deleteModalState.asset.title}</strong>. 
                  </p>
                  <div className="space-y-3">
                      {isDriveReady && !isMockMode && (
                          <button onClick={() => confirmDeleteAsset(true)} disabled={isDeleting} className="w-full flex items-center justify-between p-4 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 rounded-xl text-left transition-colors group">
                              <div><div className="font-bold text-red-400 text-sm mb-0.5">Delete Everywhere</div><div className="text-[10px] text-red-300/60">Remove from dashboard & trash Cloud files</div></div>
                              <Trash2 size={18} className="text-red-500 group-hover:scale-110 transition-transform"/>
                          </button>
                      )}
                      <button onClick={() => confirmDeleteAsset(false)} disabled={isDeleting} className="w-full flex items-center justify-between p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-left transition-colors group">
                          <div><div className="font-bold text-zinc-200 text-sm mb-0.5">Remove from Dashboard</div><div className="text-[10px] text-zinc-500">Files remain in your storage</div></div>
                          <X size={18} className="text-zinc-400 group-hover:text-white transition-colors"/>
                      </button>
                  </div>
                  <button onClick={() => setDeleteModalState({ isOpen: false, asset: null })} className="mt-6 w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 font-medium">Cancel</button>
              </div>
          </div>
      )}
      
       {/* SHARE MODALS - UNIFIED */}
       {(isShareModalOpen || isParticipantsModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl relative p-6">
              <button onClick={() => { setIsShareModalOpen(false); setIsParticipantsModalOpen(false); setShareTarget(null); }} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><X size={20} /></button>
              
              {isShareModalOpen && shareTarget && (
                <>
                  <div className="flex items-center gap-2 mb-4">
                      <div className={`p-1.5 rounded-lg ${shareTarget.type === 'project' ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                          {shareTarget.type === 'project' ? <UserPlus size={18} /> : <Eye size={18} />}
                      </div>
                      <h2 className="text-lg font-bold text-white">
                          Share "{shareTarget.name}"
                      </h2>
                  </div>
                  
                  {project.orgId ? (
                      <div className="mt-4">
                          <p className="text-xs text-zinc-400 mb-4">This project belongs to an organization. Manage access in settings.</p>
                          <button onClick={() => { setIsShareModalOpen(false); setIsOrgSettingsOpen(true); }} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                              <Settings size={14} /> Open Org Settings
                          </button>
                      </div>
                  ) : (
                      <>
                        {/* UNIFIED TABS FOR PROJECT SHARE */}
                        {shareTarget.type === 'project' && (
                            <div className="flex p-1 bg-zinc-800 rounded-xl mb-6">
                                <button 
                                    onClick={() => setShareTab('public')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${shareTab === 'public' ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    Client Review
                                </button>
                                <button 
                                    onClick={() => setShareTab('invite')}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${shareTab === 'invite' ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
                                >
                                    Invite Team
                                </button>
                            </div>
                        )}

                        {/* TAB 1: CLIENT REVIEW (PUBLIC LINK) */}
                        {(shareTab === 'public' || shareTarget.type === 'asset') && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                                <div className={`p-3 rounded-xl border flex items-start gap-3 ${shareTarget.type === 'project' ? 'bg-blue-900/10 border-blue-500/20' : 'bg-orange-900/10 border-orange-500/20'}`}>
                                    <Globe className={`shrink-0 mt-0.5 ${shareTarget.type === 'project' ? 'text-blue-400' : 'text-orange-400'}`} size={18} />
                                    <div>
                                        <h3 className={`text-xs font-bold mb-1 ${shareTarget.type === 'project' ? 'text-blue-300' : 'text-orange-300'}`}>
                                            {shareTarget.type === 'project' ? "Public Access" : "Restricted Access"}
                                        </h3>
                                        <p className={`text-[10px] leading-relaxed ${shareTarget.type === 'project' ? 'text-blue-200/70' : 'text-orange-200/70'}`}>
                                            {shareTarget.type === 'project' 
                                                ? "Anyone with the link can view files. No sign-up required." 
                                                : "User will see ONLY this specific file."}
                                        </p>
                                    </div>
                                </div>

                                {shareTarget.type === 'project' && (
                                    <div className="flex items-center justify-between py-2 border-b border-zinc-800">
                                        <span className="text-sm text-zinc-300 font-medium">Enable Link Access</span>
                                        <button 
                                            onClick={togglePublicAccess}
                                            disabled={isTogglingAccess}
                                            className={`w-10 h-5 rounded-full relative transition-colors ${project.publicAccess === 'view' ? 'bg-green-500' : 'bg-zinc-600'}`}
                                        >
                                            <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${project.publicAccess === 'view' ? 'left-6' : 'left-1'}`}></div>
                                        </button>
                                    </div>
                                )}

                                {(project.publicAccess === 'view' || shareTarget.type === 'asset') && (
                                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                                        <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Review Link</div>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="text" 
                                                readOnly 
                                                value={
                                                    shareTarget.type === 'project' 
                                                        ? `${window.location.origin}?projectId=${shareTarget.id}` 
                                                        : `${window.location.origin}?projectId=${project.id}&assetId=${shareTarget.id}`
                                                } 
                                                className="bg-transparent flex-1 text-xs text-zinc-300 outline-none truncate font-mono" 
                                            />
                                            <button onClick={handleCopyLink} className={`px-3 py-1.5 rounded text-xs transition-all shrink-0 flex items-center gap-1 font-bold ${isCopied ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
                                                {isCopied ? <Check size={12} /> : <Copy size={12} />}{isCopied ? t('common.copied') : t('common.copy')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* TAB 2: INVITE TEAM */}
                        {shareTarget.type === 'project' && shareTab === 'invite' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="bg-green-900/10 border border-green-500/20 p-3 rounded-xl flex gap-3">
                                    <UserPlus className="text-green-400 shrink-0 mt-0.5" size={18} />
                                    <div>
                                        <h3 className="text-xs font-bold text-green-300 mb-1">Team Member</h3>
                                        <p className="text-[10px] text-green-200/70 leading-relaxed">
                                            Full access to edit, upload, and comment. User will be added to the project team.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3">
                                    <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Invite Link</div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="text" 
                                            readOnly 
                                            value={`${window.location.origin}?projectId=${shareTarget.id}&invite=true`} 
                                            className="bg-transparent flex-1 text-xs text-zinc-300 outline-none truncate font-mono" 
                                        />
                                        <button onClick={handleCopyLink} className={`px-3 py-1.5 rounded text-xs transition-all shrink-0 flex items-center gap-1 font-bold ${isCopied ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
                                            {isCopied ? <Check size={12} /> : <Copy size={12} />}{isCopied ? t('common.copied') : t('common.copy')}
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 border-t border-zinc-800 pt-4">
                                    <div className="text-[10px] text-zinc-500 uppercase font-bold mb-2 flex items-center gap-2">
                                        Invite via Email
                                        {!canInviteTeam && <span className="px-1.5 py-0.5 bg-indigo-900/30 text-indigo-400 rounded border border-indigo-500/20 flex items-center gap-1"><Crown size={8} /> PRO</span>}
                                    </div>
                                    
                                    {canInviteTeam ? (
                                        <div className="flex gap-2">
                                            <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Enter email..." className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white flex-1 outline-none focus:border-indigo-600" />
                                            <button onClick={handleInviteUser} disabled={!inviteEmail} className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50">Add</button>
                                        </div>
                                    ) : (
                                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-center">
                                            <p className="text-[10px] text-zinc-500 mb-2">Invite specific people to your team to collaborate privately.</p>
                                            <button className="w-full bg-zinc-800 text-zinc-400 text-xs font-bold py-1.5 rounded cursor-not-allowed opacity-50" disabled>Upgrade to Invite</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                      </>
                  )}
                </>
              )}

              {isParticipantsModalOpen && !project.orgId && (
                  <>
                    <h2 className="text-lg font-bold text-white mb-4">Project Team</h2>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {displayTeam.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 group">
                                <div className="flex items-center gap-2">
                                    <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full border border-zinc-800" />
                                    <div><div className="text-sm text-zinc-200 font-medium">{member.name}</div><div className="text-[10px] text-zinc-500">{getDisplayRole(member)}</div></div>
                                </div>
                                {isProjectOwner && member.id !== currentUser.id && (
                                    <button onClick={() => handleRemoveUser(member.id)} className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"><Trash2 size={14} /></button>
                                )}
                            </div>
                        ))}
                    </div>
                  </>
              )}

              {isParticipantsModalOpen && project.orgId && (
                <>
                  <h2 className="text-lg font-bold text-white mb-4">{t('pv.team')}</h2>
                  <div className="mb-4 text-xs text-zinc-500 bg-zinc-800/50 p-2 rounded flex items-center justify-between">
                      <span>Managed by Organization</span>
                      <button onClick={() => { setIsParticipantsModalOpen(false); setIsOrgSettingsOpen(true); }} className="text-indigo-400 hover:text-indigo-300 font-bold">Manage</button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {displayTeam.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 group">
                          <div className="flex items-center gap-2">
                              <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full border border-zinc-800" />
                              <div><div className="text-sm text-zinc-200 font-medium flex items-center gap-2">{member.name}{member.id === currentUser.id && <span className="text-[10px] text-zinc-500">(You)</span>}</div><div className={`text-[10px] uppercase font-bold text-indigo-400`}>{getDisplayRole(member)}</div></div>
                          </div>
                        </div>
                    ))}
                  </div>
                </>
              )}
           </div>
        </div>
      )}

      {/* CLERK ORG PROFILE MODAL */}
      {isOrgSettingsOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="relative w-full max-w-4xl bg-zinc-900 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto border border-zinc-800">
                  <button onClick={() => setIsOrgSettingsOpen(false)} className="absolute top-4 right-4 z-50 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-white transition-colors">
                      <X size={20} />
                  </button>
                  <div className="p-4">
                      {/* Removed routing="hash" to fix potential conflicts */}
                      <OrganizationProfile 
                        appearance={{
                            elements: {
                                card: "shadow-none border-0 bg-transparent",
                                navbar: "hidden",
                                navbarMobileMenuButton: "hidden",
                                headerTitle: "text-white",
                                headerSubtitle: "text-zinc-400",
                                profileSectionTitleText: "text-white",
                                userPreviewMainIdentifier: "text-white",
                                userPreviewSecondaryIdentifier: "text-zinc-400",
                            },
                            variables: {
                                colorPrimary: "#4f46e5",
                                colorBackground: "#18181b",
                                colorText: "#fff",
                                colorInputBackground: "#09090b",
                                colorInputText: "#fff",
                            }
                        }}
                      />
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
