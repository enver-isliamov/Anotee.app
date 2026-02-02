
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Project, ProjectAsset, User, StorageType, UploadTask } from '../types';
import { ChevronLeft, Upload, Clock, Loader2, Copy, Check, X, Clapperboard, ChevronRight, Link as LinkIcon, Trash2, UserPlus, Info, History, Lock, Cloud, HardDrive, AlertTriangle, Shield, Eye, FileVideo, Unlock, Globe, Building2, User as UserIcon, Settings } from 'lucide-react';
import { generateId } from '../services/utils';
import { ToastType } from './Toast';
import { LanguageSelector } from './LanguageSelector';
import { useLanguage } from '../services/i18n';
import { GoogleDriveService } from '../services/googleDrive';
import { api } from '../services/apiClient';
import { useOrganization, OrganizationProfile } from '@clerk/clerk-react';
import { useDrive } from '../services/driveContext';
import { mapClerkUserToAppUser, isOrgAdmin } from '../services/userUtils';

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
  uploadTasks?: UploadTask[];
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project, currentUser, onBack, onSelectAsset, onUpdateProject, notify, restrictedAssetId, isMockMode = false, onUploadAsset, uploadTasks = [] }) => {
  const { t } = useLanguage();
  
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
  
  const canEditProject = (isProjectOwner || isProjectMember) && !restrictedAssetId;
  const canDeleteAssets = (isProjectOwner || isAdmin || (isProjectMember && project.orgId)) && !restrictedAssetId;
  const isLocked = project.isLocked;

  // Delete State
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean, asset: ProjectAsset | null }>({ isOpen: false, asset: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const [uploadingVersionFor, setUploadingVersionFor] = useState<string | null>(null);
  
  // Use Context
  const { isDriveReady } = useDrive();
  const [useDriveStorage, setUseDriveStorage] = useState(false);
  
  // Share / Team View State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{type: 'project' | 'asset', id: string, name: string} | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  
  // Org Settings Modal
  const [isOrgSettingsOpen, setIsOrgSettingsOpen] = useState(false);
  
  // Drag & Drop
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);

  const visibleAssets = restrictedAssetId 
    ? project.assets.filter(a => a.id === restrictedAssetId)
    : project.assets;

  // Split tasks: those for new assets (no targetId) and those for version updates (targetId)
  const activeTasks = uploadTasks.filter(task => 
      task.projectId === project.id && (task.status === 'uploading' || task.status === 'processing')
  );
  
  const newAssetTasks = activeTasks.filter(t => !t.targetAssetId);
  // Version tasks are handled inside the map of existing assets

  useEffect(() => {
    if (isDriveReady) {
        setUseDriveStorage(true);
    }
  }, [isDriveReady]);

  // --- HANDLERS ---
  const handleDragEnter = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0 && canEditProject && !isLocked) {
          setIsDragging(true);
      }
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
          setIsDragging(false);
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;

      if (!canEditProject || isLocked) return;

      const files = Array.from(e.dataTransfer.files);
      const videoFiles = files.filter(f => f.type.startsWith('video/'));
      
      if (videoFiles.length === 0) {
          if (files.length > 0) notify(t('notify.video_only'), "warning");
          return;
      }
      onUploadAsset(videoFiles[0], project.id, useDriveStorage);
  };

  const toggleStorage = () => {
      if (isMockMode) {
          notify("Drive Storage unavailable in Mock Mode", "info");
          return;
      }
      if (!isDriveReady && !useDriveStorage) {
          notify(t('notify.connect_drive'), "info");
          return;
      }
      setUseDriveStorage(!useDriveStorage);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadAsset(e.target.files[0], project.id, useDriveStorage);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleVersionFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && uploadingVersionFor) {
        onUploadAsset(e.target.files[0], project.id, useDriveStorage, uploadingVersionFor);
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
            if (deleteFromDrive && isDriveReady) {
                notify(t('notify.drive_delete'), "info");
                for (const v of asset.versions) {
                    if (v.storageType === 'drive' && v.googleDriveId) {
                        await GoogleDriveService.deleteFile(v.googleDriveId);
                    }
                }
            }

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
        notify(t('notify.delete_error'), "error");
    } finally {
        setIsDeleting(false);
        setDeleteModalState({ isOpen: false, asset: null });
    }
  };

  const handleShareProject = () => {
    if (isLocked) return;
    setShareTarget({ type: 'project', id: project.id, name: project.name });
    setIsShareModalOpen(true);
  };

  const handleShareAsset = (e: React.MouseEvent, asset: ProjectAsset) => {
    e.stopPropagation(); 
    if (isLocked) {
        notify(t('dash.locked_msg'), "error");
        return;
    }
    setShareTarget({ type: 'asset', id: asset.id, name: asset.title });
    setIsShareModalOpen(true);
  };

  const handleAddVersionClick = (e: React.MouseEvent, assetId: string) => {
      e.stopPropagation();
      setUploadingVersionFor(assetId);
      setTimeout(() => versionInputRef.current?.click(), 0);
  };

  const handleFixPermissions = async (e: React.MouseEvent, driveId: string) => {
      e.stopPropagation();
      notify(t('notify.perm_fixed'), "info");
      const success = await GoogleDriveService.makeFilePublic(driveId);
      if (success) notify(t('common.success'), "success");
      else notify(t('notify.perm_fail'), "error");
  };

  const togglePublicAccess = async () => {
      const newAccess = project.publicAccess === 'view' ? 'none' : 'view';
      if (!isMockMode) {
          try {
              await api.patchProject(project.id, { publicAccess: newAccess }, project._version || 0);
          } catch(e) {
              notify(t('notify.settings_fail'), "error");
              return;
          }
      }
      onUpdateProject({ ...project, publicAccess: newAccess });
      notify(newAccess === 'view' ? t('notify.link_enabled') : t('notify.link_disabled'), "info");
  };

  const handleInviteUser = async () => {
      if (!inviteEmail.trim()) return;
      if (!inviteEmail.includes('@')) {
          notify(t('notify.invalid_email'), "error");
          return;
      }

      const newMember: User = {
          id: inviteEmail, 
          name: inviteEmail.split('@')[0],
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${inviteEmail}`
      };

      const currentTeam = project.team || [];
      if (currentTeam.some(m => m.id === newMember.id || (m as any).email === inviteEmail)) {
          notify(t('notify.user_exists'), "warning");
          return;
      }

      const newTeam = [...currentTeam, { ...newMember, email: inviteEmail }]; 
      
      if (!isMockMode) {
          try {
              await api.patchProject(project.id, { team: newTeam }, project._version || 0);
          } catch (e) {
              notify(t('notify.invite_fail'), "error");
              return;
          }
      }
      
      onUpdateProject({ ...project, team: newTeam });
      setInviteEmail('');
      notify(t('notify.user_added'), "success");
  };

  const handleRemoveUser = async (userId: string) => {
      if (!confirm(t('pv.remove_user_confirm'))) return;
      const newTeam = (project.team || []).filter(m => m.id !== userId);
      if (!isMockMode) {
          try {
              await api.patchProject(project.id, { team: newTeam }, project._version || 0);
          } catch (e) {
              notify(t('notify.remove_fail'), "error");
              return;
          }
      }
      onUpdateProject({ ...project, team: newTeam });
      notify(t('notify.user_removed'), "info");
  };

  const handleCopyLink = () => {
    const origin = window.location.origin;
    let url = '';
    if (shareTarget?.type === 'project') {
       url = `${origin}?projectId=${shareTarget.id}`;
    } else {
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

  return (
    <div 
        className="flex flex-col h-screen bg-zinc-950 relative"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
    >
      <header className="h-14 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-2 md:px-4 shrink-0 z-20">
        <div className="flex items-center gap-2 overflow-hidden flex-1">
          <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white shrink-0 p-1 mr-1">
              <div className="flex items-center justify-center w-8 h-8 bg-zinc-800 rounded-lg shrink-0 border border-zinc-700">
                <Clapperboard size={16} className="text-zinc-400" />
              </div>
          </button>
          <div className="flex flex-col truncate">
            <span className="font-bold text-xs text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                SmoTree <span className="text-zinc-600">/</span> <span className="cursor-pointer hover:text-zinc-200 transition-colors" onClick={onBack}>{t('nav.dashboard')}</span>
            </span>
            <div className="flex items-center gap-2 font-semibold text-sm md:text-base leading-tight text-zinc-100 truncate">
               <span className="truncate">{project.name}</span>
               {isLocked && <Lock size={12} className="text-red-500" />}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <LanguageSelector />
          
          {/* TEAM AVATARS */}
          {!restrictedAssetId && (
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
          {!restrictedAssetId && !project.orgId && (
             <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-md border border-zinc-700 text-zinc-400 cursor-help" title={t('pv.personal')}>
                 <UserIcon size={12} />
                 <span className="text-[10px] font-medium uppercase tracking-wider">{t('pv.personal').split(' ')[0]}</span>
             </div>
          )}

          {!isLocked && !restrictedAssetId && (
            <>
              <div className="h-6 w-px bg-zinc-800 mx-1"></div>
              {project.orgId ? (
                  <button 
                    onClick={handleOrgInviteClick}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs md:text-sm font-medium"
                    title={t('pv.manage_team')}
                  >
                    <UserPlus size={16} />
                    <span className="hidden md:inline">{t('pv.manage_team')}</span>
                  </button>
              ) : (
                  <button 
                    onClick={handleShareProject}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs md:text-sm font-medium"
                    title={t('pv.share.title')}
                  >
                    <Globe size={16} />
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

      {restrictedAssetId && (
        <div className="bg-orange-900/20 border-b border-orange-900/30 text-orange-400 text-xs py-1 text-center font-medium flex items-center justify-center gap-2">
            <Info size={12} />
            {t('pv.restricted_asset')}
        </div>
      )}

      {/* DROP OVERLAY */}
      {isDragging && !isLocked && (
          <div className="absolute inset-0 z-50 bg-indigo-600/90 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-in fade-in duration-200 border-4 border-white/20 border-dashed m-4 rounded-3xl">
              <FileVideo size={64} className="mb-4 animate-bounce" />
              <h2 className="text-3xl font-bold mb-2">{t('pv.drop.title')}</h2>
              <p className="text-white/80">{t('pv.drop.desc')} {useDriveStorage ? 'Google Drive' : 'Cloud Storage'}</p>
          </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-[1600px] mx-auto">
            {/* Asset Grid */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm md:text-base font-semibold text-zinc-200">{t('pv.assets')} <span className="text-zinc-500 ml-1">{visibleAssets.length}</span></h2>
                
                {canEditProject && !isLocked && (
                    <div className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileSelect}/>
                    <input type="file" ref={versionInputRef} className="hidden" accept="video/*" onChange={handleVersionFileSelect}/>
                    
                    <button
                        onClick={toggleStorage}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${useDriveStorage && isDriveReady ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}
                        title={isMockMode ? t('player.source.mock') : (isDriveReady ? t('pv.storage.drive') : t('pv.drive_disconnected'))}
                    >
                        {useDriveStorage && isDriveReady ? <HardDrive size={14} /> : <Cloud size={14} />}
                        <span className="hidden md:inline">{useDriveStorage && isDriveReady ? t('pv.storage.drive') : (isMockMode ? t('pv.storage.local') : t('pv.storage.cloud'))}</span>
                    </button>

                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors text-xs md:text-sm font-medium border border-indigo-700/50 min-w-[100px] justify-center"
                    >
                        <Upload size={14} />
                        {t('pv.upload_asset')}
                    </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {visibleAssets.length === 0 && activeTasks.length === 0 && !isDragging && (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="col-span-full h-[60vh] border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:border-indigo-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-all cursor-pointer group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-10 font-black text-9xl text-indigo-500 rotate-12 pointer-events-none">02</div>
                        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm relative z-10">
                            <Upload size={32} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                        </div>
                        <h3 className="text-xl font-bold mb-2 relative z-10">{t('pv.step2.title')}</h3>
                        <p className="text-sm max-w-xs text-center mb-6 relative z-10 text-zinc-500">
                            {t('pv.step2.desc')} <br/>
                            <span className="text-xs opacity-70">{t('pv.step2.formats')}</span>
                        </p>
                        <button className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all pointer-events-none relative z-10">
                            {t('pv.upload_asset')}
                        </button>
                    </div>
                )}

                {/* GHOST TILES FOR NEW ASSETS ONLY */}
                {newAssetTasks.map(task => (
                    <div key={task.id} className="group bg-zinc-900 rounded-lg overflow-hidden border border-indigo-500/50 relative shadow-sm animate-pulse">
                        <div className="aspect-video bg-zinc-950 relative overflow-hidden flex items-center justify-center">
                            {task.thumbnail ? (
                                <img src={task.thumbnail} className="w-full h-full object-cover opacity-50 blur-[2px]" />
                            ) : (
                                <div className="bg-zinc-800 w-full h-full flex items-center justify-center">
                                    <FileVideo size={32} className="text-zinc-700" />
                                </div>
                            )}
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                <Loader2 size={24} className="text-indigo-500 animate-spin mb-2" />
                                <span className="text-xs font-bold text-white shadow-black drop-shadow-md">{task.progress}%</span>
                            </div>
                            {/* Progress Overlay */}
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800">
                                <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${task.progress}%` }}></div>
                            </div>
                        </div>
                        <div className="p-3">
                            <h3 className="font-medium text-zinc-400 text-xs md:text-sm truncate mb-1">{task.file.name}</h3>
                            <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">{t('common.uploading')}</div>
                        </div>
                    </div>
                ))}

                {visibleAssets.map((asset) => {
                    const lastVer = asset.versions[asset.versions.length-1];
                    const isDrive = lastVer?.storageType === 'drive';
                    
                    // Check if this asset is currently receiving a new version upload
                    const activeUpload = activeTasks.find(t => t.targetAssetId === asset.id);

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
                                className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${activeUpload ? 'opacity-40 blur-[1px]' : 'opacity-80 group-hover:opacity-100'}`}
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80'; }}
                            />
                            
                            {/* VERSION UPLOAD OVERLAY */}
                            {activeUpload && (
                                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60">
                                    <Loader2 size={24} className="text-indigo-500 animate-spin mb-2" />
                                    <span className="text-xs font-bold text-white shadow-black drop-shadow-md">Uploading v{asset.versions.length + 1}... {activeUpload.progress}%</span>
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800/50">
                                        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${activeUpload.progress}%` }}></div>
                                    </div>
                                </div>
                            )}

                            {isDrive && !activeUpload && <div className="absolute top-2 left-2 z-10 bg-black/60 text-green-400 p-1 rounded backdrop-blur-sm"><HardDrive size={10} /></div>}
                            
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                                {!isLocked && !activeUpload && (
                                    <button 
                                        onClick={(e) => handleShareAsset(e, asset)}
                                        className="p-1.5 bg-black/60 hover:bg-indigo-600 text-white rounded-md backdrop-blur-sm transition-colors"
                                        title={t('pv.copy_link')}
                                    >
                                        <LinkIcon size={12} />
                                    </button>
                                )}
                                {canEditProject && !isLocked && !activeUpload && (
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
                            <span>{asset.versions[asset.versions.length-1]?.uploadedAt === 'Just now' ? t('time.just_now') : asset.versions[asset.versions.length-1]?.uploadedAt}</span>
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
                      <h3 className="text-lg font-bold text-white">{t('pv.del_modal.title')}</h3>
                  </div>
                  <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                      {t('pv.del_modal.desc')} <strong>{deleteModalState.asset.title}</strong>. 
                  </p>
                  <div className="space-y-3">
                      {isDriveReady && !isMockMode && (
                          <button onClick={() => confirmDeleteAsset(true)} disabled={isDeleting} className="w-full flex items-center justify-between p-4 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 rounded-xl text-left transition-colors group">
                              <div><div className="font-bold text-red-400 text-sm mb-0.5">{t('pv.del_modal.everywhere')}</div><div className="text-[10px] text-red-300/60">{t('pv.del_modal.everywhere_desc')}</div></div>
                              <Trash2 size={18} className="text-red-500 group-hover:scale-110 transition-transform"/>
                          </button>
                      )}
                      <button onClick={() => confirmDeleteAsset(false)} disabled={isDeleting} className="w-full flex items-center justify-between p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-left transition-colors group">
                          <div><div className="font-bold text-zinc-200 text-sm mb-0.5">{t('pv.del_modal.dash')}</div><div className="text-[10px] text-zinc-500">{t('pv.del_modal.dash_desc')}</div></div>
                          <X size={18} className="text-zinc-400 group-hover:text-white transition-colors"/>
                      </button>
                  </div>
                  <button onClick={() => setDeleteModalState({ isOpen: false, asset: null })} className="mt-6 w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 font-medium">{t('cancel')}</button>
              </div>
          </div>
      )}
      
       {/* SHARE MODALS */}
       {(isShareModalOpen || isParticipantsModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl relative p-6">
              <button onClick={() => { setIsShareModalOpen(false); setIsParticipantsModalOpen(false); setShareTarget(null); }} className="absolute top-4 right-4 text-zinc-400 hover:text-white"><X size={20} /></button>
              
              {isShareModalOpen && shareTarget && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                      <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                          {project.orgId ? <UserPlus size={18} /> : <Globe size={18} />}
                      </div>
                      <h2 className="text-lg font-bold text-white">{t('pv.share.title')}</h2>
                  </div>
                  
                  {project.orgId ? (
                      <div className="mt-4">
                          <p className="text-xs text-zinc-400 mb-4">{t('pv.share.org_notice')}</p>
                          <button onClick={() => { setIsShareModalOpen(false); setIsOrgSettingsOpen(true); }} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                              <Settings size={14} /> {t('pv.org_settings')}
                          </button>
                      </div>
                  ) : (
                      <>
                        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">{t('pv.share.desc')}</p>
                        
                        {shareTarget.type === 'project' && isProjectOwner && (
                            <div className="mb-4 bg-zinc-800/50 p-3 rounded-xl border border-zinc-700 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-zinc-300">
                                    <Globe size={16} className={project.publicAccess === 'view' ? 'text-green-400' : 'text-zinc-500'} />
                                    <div className="flex flex-col"><span className="text-xs font-bold text-white">{t('pv.share.public_access')}</span><span className="text-[9px] text-zinc-500">{t('pv.share.public_desc')}</span></div>
                                </div>
                                <button onClick={togglePublicAccess} className={`w-10 h-5 rounded-full relative transition-colors ${project.publicAccess === 'view' ? 'bg-green-500' : 'bg-zinc-600'}`}><div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${project.publicAccess === 'view' ? 'left-6' : 'left-1'}`}></div></button>
                            </div>
                        )}

                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 mb-2">
                            <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">{t('pv.share.review_link_label')}</div>
                            <div className="flex items-center gap-2">
                                <input type="text" readOnly value={`${window.location.origin}?projectId=${project.id}${shareTarget.type === 'asset' ? `&assetId=${shareTarget.id}` : ''}`} className="bg-transparent flex-1 text-xs text-zinc-300 outline-none truncate font-mono" />
                                <button onClick={handleCopyLink} className={`px-3 py-1.5 rounded text-xs transition-all shrink-0 flex items-center gap-1 font-medium ${isCopied ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>{isCopied ? <Check size={12} /> : <Copy size={12} />}{isCopied ? t('common.copied') : t('common.copy')}</button>
                            </div>
                        </div>
                        
                        {shareTarget.type === 'project' && (
                            <div className="mt-4 border-t border-zinc-800 pt-4">
                                <div className="text-[10px] text-zinc-500 uppercase font-bold mb-2">{t('pv.share.invite_personal')}</div>
                                <div className="flex gap-2">
                                    <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder={t('pv.share.email_placeholder')} className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white flex-1 outline-none focus:border-indigo-600" />
                                    <button onClick={handleInviteUser} disabled={!inviteEmail} className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50">{t('pv.share.add')}</button>
                                </div>
                            </div>
                        )}
                      </>
                  )}
                </>
              )}

              {isParticipantsModalOpen && !project.orgId && (
                  <>
                    <h2 className="text-lg font-bold text-white mb-4">{t('pv.team')}</h2>
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
                      <span>{t('pv.team.managed')}</span>
                      <button onClick={() => { setIsParticipantsModalOpen(false); setIsOrgSettingsOpen(true); }} className="text-indigo-400 hover:text-indigo-300 font-bold">{t('pv.team.manage_btn')}</button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {displayTeam.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 group">
                          <div className="flex items-center gap-2">
                              <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full border border-zinc-800" />
                              <div><div className="text-sm text-zinc-200 font-medium flex items-center gap-2">{member.name}{member.id === currentUser.id && <span className="text-[10px] text-zinc-500">{t('pv.team.you')}</span>}</div><div className={`text-[10px] uppercase font-bold text-indigo-400`}>{getDisplayRole(member)}</div></div>
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
