
import React, { useState, useRef, useEffect } from 'react';
import { Project, ProjectAsset, User, UserRole, StorageType } from '../types';
import { ChevronLeft, Upload, Clock, Loader2, Copy, Check, X, Clapperboard, ChevronRight, Link as LinkIcon, Trash2, UserPlus, Info, History, Lock, Cloud, HardDrive, AlertTriangle, Shield, Eye } from 'lucide-react';
import { generateId } from '../services/utils';
import { ToastType } from './Toast';
import { LanguageSelector } from './LanguageSelector';
import { useLanguage } from '../services/i18n';
import { GoogleDriveService } from '../services/googleDrive';
import { api } from '../services/apiClient';

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
}

export const ProjectView: React.FC<ProjectViewProps> = ({ project, currentUser, onBack, onSelectAsset, onUpdateProject, notify, restrictedAssetId, isMockMode = false, onUploadAsset }) => {
  const { t } = useLanguage();
  
  // Delete State
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean, asset: ProjectAsset | null }>({ isOpen: false, asset: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const [uploadingVersionFor, setUploadingVersionFor] = useState<string | null>(null);
  const [useDriveStorage, setUseDriveStorage] = useState(false);
  const [isDriveReady, setIsDriveReady] = useState(GoogleDriveService.isAuthenticated());
  
  // Share / Team View State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{type: 'project' | 'asset', id: string, name: string} | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const versionInputRef = useRef<HTMLInputElement>(null);
  
  const isProjectMember = project.team.some(m => m.id === currentUser.id);
  const isProjectOwner = project.ownerId === currentUser.id;
  
  // Can Upload/Delete? Owner OR Team Member
  const canEditProject = (isProjectOwner || isProjectMember) && !restrictedAssetId;
  const isLocked = project.isLocked;

  // Filter Assets for Restricted Mode
  const visibleAssets = restrictedAssetId 
    ? project.assets.filter(a => a.id === restrictedAssetId)
    : project.assets;

  useEffect(() => {
    const handleDriveUpdate = () => {
        setIsDriveReady(GoogleDriveService.isAuthenticated());
        // If drive becomes ready, auto-switch to it
        if (GoogleDriveService.isAuthenticated()) setUseDriveStorage(true);
    };
    window.addEventListener('drive-token-updated', handleDriveUpdate);
    
    if (GoogleDriveService.isAuthenticated()) {
        setUseDriveStorage(true);
    }
    
    return () => window.removeEventListener('drive-token-updated', handleDriveUpdate);
  }, []);

  const toggleStorage = () => {
      if (isMockMode) {
          notify("Drive Storage unavailable in Mock Mode", "info");
          return;
      }
      if (!isDriveReady && !useDriveStorage) {
          notify("Please connect Google Drive in your Profile first.", "info");
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
                notify("Deleting files from Drive...", "info");
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
                await api.deleteAssets(urlsToDelete);
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

  const handleRemoveMember = (memberId: string) => {
      if (!isProjectOwner) return;
      if (memberId === project.ownerId) { notify(t('common.error'), "error"); return; }
      if (!confirm(t('pv.remove_confirm'))) return;
      const updatedTeam = project.team.filter(m => m.id !== memberId);
      onUpdateProject({ ...project, team: updatedTeam });
      notify(t('common.success'), "info");
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

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
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
          {!restrictedAssetId && (
            <div 
              onClick={() => setIsParticipantsModalOpen(true)}
              className="flex -space-x-2 cursor-pointer hover:opacity-80 transition-opacity ml-2"
              title={t('pv.team')}
            >
              {project.team.slice(0, 3).map((member) => (
                  <img key={member.id} src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full border-2 border-zinc-950" />
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-zinc-950 bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400">
                {project.team.length > 3 ? `+${project.team.length - 3}` : '+'}
              </div>
            </div>
          )}
          {!isLocked && !restrictedAssetId && (
            <>
              <div className="h-6 w-px bg-zinc-800 mx-1"></div>
              <button 
                onClick={handleShareProject}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors text-xs md:text-sm font-medium"
                title={t('pv.invite')}
              >
                <UserPlus size={16} />
                <span className="hidden md:inline">{t('pv.invite')}</span>
              </button>
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
            Viewing restricted asset. Full project access limited.
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm md:text-base font-semibold text-zinc-200">{t('pv.assets')} <span className="text-zinc-500 ml-1">{visibleAssets.length}</span></h2>
                
                {canEditProject && !isLocked && (
                    <div className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileSelect}/>
                    <input type="file" ref={versionInputRef} className="hidden" accept="video/*" onChange={handleVersionFileSelect}/>
                    
                    <button
                        onClick={toggleStorage}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${useDriveStorage && isDriveReady ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}
                        title={isMockMode ? "Mock Mode (Local)" : (isDriveReady ? "Toggle Storage" : "Drive not connected")}
                    >
                        {useDriveStorage && isDriveReady ? <HardDrive size={14} /> : <Cloud size={14} />}
                        <span className="hidden md:inline">{useDriveStorage && isDriveReady ? "Drive Storage" : (isMockMode ? "Local Mode" : "SmoTree Cloud")}</span>
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
                {visibleAssets.map((asset) => {
                    const lastVer = asset.versions[asset.versions.length-1];
                    const isDrive = lastVer?.storageType === 'drive';
                    
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
                        
                        {isDrive && (
                            <div className="absolute top-2 left-2 z-10 bg-black/60 text-green-400 p-1 rounded backdrop-blur-sm" title="Stored on Google Drive">
                                <HardDrive size={10} />
                            </div>
                        )}

                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                            {!isLocked && (
                                <button 
                                    onClick={(e) => handleShareAsset(e, asset)}
                                    className="p-1.5 bg-black/60 hover:bg-indigo-600 text-white rounded-md backdrop-blur-sm transition-colors"
                                    title={t('pv.copy_link')}
                                >
                                    <LinkIcon size={12} />
                                </button>
                            )}
                            
                            {canEditProject && !isLocked && (
                                <>
                                    <button 
                                        onClick={(e) => handleAddVersionClick(e, asset.id)}
                                        className="p-1.5 bg-black/60 hover:bg-blue-500 text-white rounded-md backdrop-blur-sm transition-colors"
                                        title={t('pv.upload_new_ver')}
                                    >
                                        <History size={12} />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setDeleteModalState({ isOpen: true, asset: asset }); }}
                                        className="p-1.5 bg-black/60 hover:bg-red-500 text-white rounded-md backdrop-blur-sm transition-colors"
                                        title={t('pv.delete_asset')}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </>
                            )}
                        </div>

                        <div className="absolute bottom-2 left-2 bg-black/60 px-1.5 py-0.5 rounded text-[10px] text-white font-mono backdrop-blur-sm">
                            v{asset.versions.length}
                        </div>
                        </div>

                        <div className="p-3">
                        <h3 className="font-medium text-zinc-200 text-xs md:text-sm truncate mb-1">{asset.title}</h3>
                        <div className="flex justify-between items-center text-[10px] text-zinc-500">
                            <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {asset.versions[asset.versions.length-1]?.comments.length}
                            </span>
                            <span>{asset.versions[asset.versions.length-1]?.uploadedAt}</span>
                        </div>
                        </div>
                    </div>
                )})}
            </div>
          </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalState.isOpen && deleteModalState.asset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                  <div className="flex items-center gap-3 mb-4 text-red-500">
                      <AlertTriangle size={32} />
                      <h3 className="text-lg font-bold text-white">Delete Asset?</h3>
                  </div>
                  <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                      You are about to delete <strong>{deleteModalState.asset.title}</strong>. 
                      How would you like to proceed?
                  </p>
                  
                  <div className="space-y-3">
                      {isDriveReady && !isMockMode && (
                          <button 
                            onClick={() => confirmDeleteAsset(true)} 
                            disabled={isDeleting}
                            className="w-full flex items-center justify-between p-4 bg-red-900/20 hover:bg-red-900/40 border border-red-900/50 rounded-xl text-left transition-colors group"
                          >
                              <div>
                                  <div className="font-bold text-red-400 text-sm mb-0.5">Delete Everywhere</div>
                                  <div className="text-[10px] text-red-300/60">Remove from dashboard & trash Drive files</div>
                              </div>
                              <Trash2 size={18} className="text-red-500 group-hover:scale-110 transition-transform"/>
                          </button>
                      )}
                      
                      <button 
                        onClick={() => confirmDeleteAsset(false)}
                        disabled={isDeleting} 
                        className="w-full flex items-center justify-between p-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-left transition-colors group"
                      >
                          <div>
                              <div className="font-bold text-zinc-200 text-sm mb-0.5">Remove from Dashboard</div>
                              <div className="text-[10px] text-zinc-500">Files remain in your storage</div>
                          </div>
                          <X size={18} className="text-zinc-400 group-hover:text-white transition-colors"/>
                      </button>
                  </div>

                  <button 
                    onClick={() => setDeleteModalState({ isOpen: false, asset: null })}
                    className="mt-6 w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 font-medium"
                  >
                      Cancel
                  </button>
              </div>
          </div>
      )}
      
       {/* Share Modal & Participants Modal (same as before) */}
       {(isShareModalOpen || isParticipantsModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
           <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl relative p-6">
              <button 
                onClick={() => { setIsShareModalOpen(false); setIsParticipantsModalOpen(false); setShareTarget(null); }}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
              
              {isShareModalOpen && shareTarget && (
                <>
                  <div className="flex items-center gap-2 mb-1">
                      <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                          <UserPlus size={18} />
                      </div>
                      <h2 className="text-lg font-bold text-white">{t('pv.share.title')}</h2>
                  </div>
                  
                  <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                     {t('pv.share.desc')}
                  </p>
                  
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 mb-2">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">{t('pv.share.link')}</div>
                    <div className="flex items-center gap-2">
                        <input 
                        type="text" 
                        readOnly 
                        value={`${window.location.origin}?projectId=${project.id}${shareTarget.type === 'asset' ? `&assetId=${shareTarget.id}` : ''}`} 
                        className="bg-transparent flex-1 text-xs text-zinc-300 outline-none truncate font-mono" 
                        />
                        <button onClick={handleCopyLink} className={`px-3 py-1.5 rounded text-xs transition-all shrink-0 flex items-center gap-1 font-medium ${isCopied ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>
                        {isCopied ? <Check size={12} /> : <Copy size={12} />}
                        {isCopied ? t('common.copied') : t('common.copy')}
                        </button>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2 bg-indigo-900/10 p-2 rounded border border-indigo-500/10">
                      <Info size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-indigo-200/70">
                          {t('pv.share.info')}
                      </p>
                  </div>
                </>
              )}

              {isParticipantsModalOpen && (
                <>
                  <h2 className="text-lg font-bold text-white mb-4">{t('pv.team')}</h2>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {project.team.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-2 rounded hover:bg-zinc-800/50 group">
                          <div className="flex items-center gap-2">
                              <img src={member.avatar} alt={member.name} className="w-8 h-8 rounded-full border border-zinc-800" />
                              <div>
                                <div className="text-sm text-zinc-200 font-medium flex items-center gap-2">
                                    {member.name}
                                    {member.id === currentUser.id && <span className="text-[10px] text-zinc-500">(You)</span>}
                                </div>
                                <div className={`text-[10px] uppercase font-bold text-indigo-400`}>
                                    {getDisplayRole(member)}
                                </div>
                              </div>
                          </div>
                          
                          {isProjectOwner && member.id !== currentUser.id && member.id !== project.ownerId && (
                              <button 
                                onClick={() => handleRemoveMember(member.id)}
                                className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                title={t('pv.remove_user')}
                              >
                                <Trash2 size={14} />
                              </button>
                          )}
                        </div>
                    ))}
                  </div>
                </>
              )}
           </div>
        </div>
      )}
    </div>
  );
};
