
import React, { useState, useMemo } from 'react';
import { Project, User } from '../types';
import { Plus, X, Loader2, FileVideo, Lock, Trash2, AlertTriangle, CalendarClock, Edit2, Share2, Unlock, Copy, Check, Save, Crown, Zap, Shield, ArrowRight, Building2, User as UserIcon, CheckCircle2, Layout, Upload } from 'lucide-react';
import { generateId, isExpired, getDaysRemaining } from '../services/utils';
import { ToastType } from './Toast';
import { useLanguage } from '../services/i18n';
import { GoogleDriveService } from '../services/googleDrive';
import { api } from '../services/apiClient';
import { useOrganization, useUser } from '@clerk/clerk-react';
import { isOrgAdmin } from '../services/userUtils';

interface DashboardProps {
  projects: Project[];
  currentUser: User;
  onSelectProject: (project: Project) => void;
  onAddProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onEditProject: (projectId: string, data: Partial<Project>) => void;
  onNavigate: (page: string) => void; 
  notify: (msg: string, type: ToastType) => void;
  isMockMode?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, currentUser, onSelectProject, onAddProject, onDeleteProject, onEditProject, onNavigate, notify, isMockMode = false }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { t } = useLanguage();
  
  // CLERK ORG CONTEXT
  const { organization, memberships } = useOrganization({ memberships: { infinite: true } });

  // Determine if user is Admin in current Org
  const isAdmin = useMemo(() => {
      if (!organization || !memberships?.data) return false;
      return isOrgAdmin(currentUser.id, memberships.data);
  }, [organization, memberships, currentUser.id]);

  // Edit State
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Share State
  const [sharingProject, setSharingProject] = useState<Project | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Deletion State
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form State (Create)
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [description, setDescription] = useState('');

  // --- FILTERING LOGIC (ORGANIZATION AWARE) ---
  const activeOrgId = organization?.id;

  const displayedProjects = projects.filter(p => {
      // 1. If Org is selected, show projects matching THAT Org
      if (activeOrgId) {
          return p.orgId === activeOrgId;
      }
      
      // 2. If Personal Workspace (no Org selected):
      // Show projects where orgId is missing, null, empty string OR 'null' string (legacy)
      // AND user has access (Owner or Team)
      const isPersonal = !p.orgId || p.orgId === 'null' || p.orgId === '';
      const hasAccess = p.ownerId === currentUser.id || p.team.some(m => m.id === currentUser.id);
      
      return isPersonal && hasAccess;
  });
  
  const sectionTitle = activeOrgId 
    ? (organization?.name || 'Organization') + ' Projects' 
    : t('dash.my_projects');

  // PERMISSION CHECKS (Project Level)
  const canManageProject = (project: Project) => {
      // Personal: Only Owner
      if (!project.orgId) return project.ownerId === currentUser.id;
      // Org: Owner OR Admin
      return project.ownerId === currentUser.id || isAdmin;
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !client) return;

    setIsCreating(true);

    const newProject: Project = {
      id: generateId(), 
      name,
      client,
      description,
      createdAt: Date.now(), 
      updatedAt: 'Just now',
      // If Org: Clean Team (Managed by Clerk). If Personal: Add Self.
      team: activeOrgId ? [] : [currentUser],
      ownerId: currentUser.id,
      orgId: activeOrgId || null, 
      assets: [],
      isLocked: false,
      publicAccess: 'none'
    };

    onAddProject(newProject);
    
    // Reset and Close
    setIsCreating(false);
    setIsModalOpen(false);
    setName('');
    setClient('');
    setDescription('');
  };

  const handleOpenEdit = (e: React.MouseEvent, project: Project) => {
      e.stopPropagation();
      setEditingProject(project);
      setEditName(project.name);
      setEditClient(project.client);
      setEditDesc(project.description);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingProject) return;
      
      setIsSavingEdit(true);

      try {
          // Attempt to rename Drive Folder if name changed
          if (editingProject.name !== editName && GoogleDriveService.isAuthenticated()) {
              notify("Syncing name change to Google Drive...", "info");
              await GoogleDriveService.renameProjectFolder(editingProject.name, editName);
          }

          // USE PATCH (Partial Update)
          if (!isMockMode) {
              await api.patchProject(editingProject.id, {
                  name: editName,
                  client: editClient,
                  description: editDesc
              }, editingProject._version || 0);
              
              // Optimistic local update
              onEditProject(editingProject.id, {
                  name: editName,
                  client: editClient,
                  description: editDesc
              });
          } else {
              onEditProject(editingProject.id, {
                  name: editName,
                  client: editClient,
                  description: editDesc
              });
          }
          
          notify("Project updated", "success");
      } catch (err: any) {
          if (err.code === 'CONFLICT') {
             notify("Conflict detected! Someone modified this project. Please refresh.", "error");
          } else {
             notify("Failed to update project", "error");
             console.error(err);
          }
      } finally {
          setIsSavingEdit(false);
          setEditingProject(null);
      }
  };

  const handleToggleLock = async (e: React.MouseEvent, project: Project) => {
      e.stopPropagation();
      try {
          if (!isMockMode) {
              await api.patchProject(project.id, { isLocked: !project.isLocked }, project._version || 0);
          }
          onEditProject(project.id, { isLocked: !project.isLocked });
      } catch(e) { notify("Failed to toggle lock", "error"); }
  };

  const handleShareClick = (e: React.MouseEvent, project: Project) => {
      e.stopPropagation();
      if (project.isLocked) {
          notify(t('dash.locked_msg'), "error");
          return;
      }
      setSharingProject(project);
  };

  const handleCopyLink = () => {
      if (!sharingProject) return;
      const url = `${window.location.origin}?projectId=${sharingProject.id}`;
      navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      notify(t('common.link_copied'), "success");
  };

  const handleDeleteClick = async (e: React.MouseEvent, project: Project) => {
      e.stopPropagation();
      if (!confirm(t('dash.delete_confirm'))) {
          return;
      }

      setIsDeleting(project.id);
      
      const urlsToDelete: string[] = [];
      project.assets.forEach(asset => {
          asset.versions.forEach(v => {
              if (v.url.startsWith('http')) {
                  urlsToDelete.push(v.url);
              }
          });
      });

      if (urlsToDelete.length > 0) {
          await api.deleteAssets(urlsToDelete, project.id);
      }

      onDeleteProject(project.id);
      setIsDeleting(null);
  };

  const renderOnboarding = () => {
      return (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 mb-8 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>
              
              <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                      <Layout size={24} />
                  </div>
                  <div>
                      <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Get Started with SmoTree</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Follow these steps to set up your first review workflow.</p>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                  {/* Step 1: Create Project (Active) */}
                  <div className="border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl p-5 flex flex-col items-start relative group hover:shadow-md transition-all">
                      <div className="absolute top-4 right-4 text-indigo-200 dark:text-indigo-800 font-black text-4xl opacity-20">01</div>
                      <div className="mb-3 p-2 bg-white dark:bg-zinc-800 rounded-lg text-indigo-600 shadow-sm">
                          <Plus size={20} />
                      </div>
                      <h4 className="font-bold text-zinc-900 dark:text-white mb-1">Create Project</h4>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">
                          Initialize a workspace for your media assets and team collaboration.
                      </p>
                      <button 
                          onClick={() => setIsModalOpen(true)}
                          className="mt-auto w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all"
                      >
                          Start Here <ArrowRight size={12} />
                      </button>
                  </div>

                  {/* Step 2: Upload (Pending) */}
                  <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-5 flex flex-col items-start relative opacity-70 grayscale">
                      <div className="absolute top-4 right-4 text-zinc-200 dark:text-zinc-800 font-black text-4xl opacity-20">02</div>
                      <div className="mb-3 p-2 bg-white dark:bg-zinc-800 rounded-lg text-zinc-400 shadow-sm">
                          <Upload size={20} />
                      </div>
                      <h4 className="font-bold text-zinc-700 dark:text-zinc-300 mb-1">Upload Media</h4>
                      <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                          Drag & drop video files. We automatically generate proxies for smooth playback.
                      </p>
                      <div className="mt-auto w-full py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                          Waiting for Project...
                      </div>
                  </div>

                  {/* Step 3: Invite (Pending) */}
                  <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-5 flex flex-col items-start relative opacity-70 grayscale">
                      <div className="absolute top-4 right-4 text-zinc-200 dark:text-zinc-800 font-black text-4xl opacity-20">03</div>
                      <div className="mb-3 p-2 bg-white dark:bg-zinc-800 rounded-lg text-zinc-400 shadow-sm">
                          <Share2 size={20} />
                      </div>
                      <h4 className="font-bold text-zinc-700 dark:text-zinc-300 mb-1">Invite Team</h4>
                      <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
                          Share a secure link with clients or editors for frame-accurate feedback.
                      </p>
                      <div className="mt-auto w-full py-2 bg-zinc-200 dark:bg-zinc-800 text-zinc-500 rounded-lg text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                          Waiting for Upload...
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const renderProjectGrid = (projectList: Project[], title: string, icon: React.ReactNode) => {
      return (
          <div className="mb-8">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2 mb-4">
                  {icon}
                  {title}
                  <span className="text-xs font-normal text-zinc-600 dark:text-zinc-500 bg-zinc-200/50 dark:bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-800">
                      {projectList.length}
                  </span>
              </h2>
              
              {projectList.length === 0 ? (
                  // Use new Onboarding if generic empty state
                  renderOnboarding()
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {projectList.map((project) => {
                        const expired = project.createdAt ? isExpired(project.createdAt) : false;
                        const daysLeft = project.createdAt ? getDaysRemaining(project.createdAt) : 7;
                        const locked = project.isLocked;
                        const canManage = canManageProject(project);
                        const isOrgProject = !!project.orgId;
                        
                        return (
                        <div 
                            key={project.id} 
                            onClick={() => !expired && onSelectProject(project)}
                            className={`group bg-white dark:bg-zinc-900 border rounded-xl p-4 transition-all relative flex flex-col h-[180px]
                                ${expired 
                                    ? 'border-red-100 dark:border-red-900/30 opacity-70 hover:opacity-100 cursor-not-allowed' 
                                    : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/30 dark:hover:border-indigo-500/50 cursor-pointer shadow-sm hover:shadow-md'
                                }
                            `}
                        >
                            {isDeleting === project.id && (
                                <div className="absolute inset-0 bg-white/80 dark:bg-black/80 z-20 flex items-center justify-center rounded-lg">
                                    <Loader2 className="animate-spin text-red-500" />
                                </div>
                            )}

                            {/* Status Badges */}
                            <div className="absolute top-2 right-2 z-10 flex gap-1">
                                {locked && (
                                     <div className="bg-red-50 dark:bg-zinc-950 text-red-500 p-1 rounded border border-red-200 dark:border-red-500/30 shadow-sm" title="Project Locked">
                                        <Lock size={12} />
                                    </div>
                                )}
                                {project.createdAt && daysLeft <= 2 && !expired && (
                                    <div className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 text-[9px] px-1.5 py-0.5 rounded border border-orange-200 dark:border-orange-500/20 flex items-center gap-1">
                                        <CalendarClock size={10} />
                                        {daysLeft} {t('dash.days_left')}
                                    </div>
                                )}
                                {expired && (
                                    <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 text-[9px] px-1.5 py-0.5 rounded border border-red-200 dark:border-red-500/20 flex items-center gap-1">
                                        <AlertTriangle size={10} />
                                        {t('dash.expired')}
                                    </div>
                                )}
                            </div>


                            <div className="flex justify-between items-start mb-2 pr-12">
                                <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 mb-0.5 truncate max-w-[120px]">
                                    {project.client}
                                </div>
                            </div>

                            <h3 className={`text-base font-bold mb-1 truncate transition-colors pr-8 ${expired ? 'text-zinc-400' : 'text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                                {project.name}
                            </h3>
                            <p className="text-xs text-zinc-500 mb-4 line-clamp-2 leading-relaxed">
                                {project.description || 'No description provided.'}
                            </p>

                            <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800/50 mt-auto">
                                
                                {/* TEAM / ORG DISPLAY */}
                                {isOrgProject && organization ? (
                                    <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                                        <div className="w-5 h-5 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                                            {organization.imageUrl ? (
                                                <img src={organization.imageUrl} className="w-full h-full rounded object-cover" />
                                            ) : (
                                                <Building2 size={12} />
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold max-w-[80px] truncate">{organization.name}</span>
                                    </div>
                                ) : (
                                    <div className="flex -space-x-2">
                                        {project.team && project.team.slice(0, 3).map((member) => (
                                            <img 
                                            key={member.id} 
                                            src={member.avatar} 
                                            alt={member.name} 
                                            title={member.name}
                                            className="w-6 h-6 rounded-full border border-white dark:border-zinc-900 object-cover"
                                            />
                                        ))}
                                    </div>
                                )}
                                
                                {/* ACTIONS */}
                                {canManage && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => handleToggleLock(e, project)}
                                            className={`p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${project.isLocked ? 'text-red-400' : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}
                                            title={project.isLocked ? t('common.unlock') : t('common.lock')}
                                        >
                                            {project.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                                        </button>
                                        <button 
                                            onClick={(e) => handleOpenEdit(e, project)}
                                            className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                                            title={t('common.edit')}
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => handleShareClick(e, project)}
                                            className={`p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${project.isLocked ? 'text-zinc-400 cursor-not-allowed' : 'text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                                            title={t('common.share')}
                                        >
                                            <Share2 size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => handleDeleteClick(e, project)}
                                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded"
                                            title={t('common.delete')}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                                
                                {!canManage && (
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-950 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800">
                                        <FileVideo size={12} />
                                        <span>{project.assets.length}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )})}
                </div>
              )}
          </div>
      );
  };

  return (
    <>
      <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight hidden lg:block">
                {activeOrgId ? (
                    <span className="flex items-center gap-2">
                        <Building2 size={24} className="text-indigo-600 dark:text-indigo-400" />
                        {organization?.name}
                    </span>
                ) : (
                    t('nav.dashboard')
                )}
            </h2>
             
             {/* Spacer for alignment on mobile where header controls are */}
            <div className="lg:hidden"></div>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="ml-auto flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-bold shadow-lg shadow-indigo-900/20"
            >
              <Plus size={16} />
              {t('dash.new_project')}
            </button>
      </div>

      {renderProjectGrid(
          displayedProjects, 
          sectionTitle, 
          activeOrgId ? <Building2 size={18} className="text-indigo-500"/> : <UserIcon size={18} className="text-indigo-500"/>
      )}
      
      {/* UPSELL BLOCK */}
      <div className="mt-12 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-l from-indigo-50 dark:from-indigo-900/10 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10">
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
                   <Zap size={20} className="text-yellow-500" fill="currentColor"/> {t('upsell.title')}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
                  {/* Left: Free/Guest */}
                  <div className="space-y-4 opacity-60 grayscale">
                       <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-xs tracking-wider border-b border-zinc-200 dark:border-zinc-800 pb-2">
                           <Lock size={12} /> {t('upsell.free.title')}
                       </div>
                       <ul className="space-y-3 text-sm text-zinc-600 dark:text-zinc-500 font-medium">
                           <li className="flex items-center gap-2"><Check size={14}/> {t('upsell.free.feat1')}</li>
                           <li className="flex items-center gap-2 text-zinc-500 dark:text-zinc-600"><X size={14}/> {t('upsell.free.feat2')}</li>
                           <li className="flex items-center gap-2 text-zinc-500 dark:text-zinc-600"><X size={14}/> {t('upsell.free.feat3')}</li>
                       </ul>
                  </div>

                  {/* Right: Founder */}
                  <div className="space-y-4">
                       <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold uppercase text-xs tracking-wider border-b border-indigo-200 dark:border-indigo-500/30 pb-2">
                           <Crown size={12} fill="currentColor"/> {t('upsell.founder.title')}
                       </div>
                       <ul className="space-y-3 text-sm text-zinc-800 dark:text-zinc-300 font-medium">
                           <li className="flex items-center gap-2"><Check size={14} className="text-green-500 dark:text-green-400"/> {t('upsell.founder.feat1')}</li>
                           <li className="flex items-center gap-2"><Check size={14} className="text-green-500 dark:text-green-400"/> {t('upsell.founder.feat2')}</li>
                           <li className="flex items-center gap-2"><Shield size={14} className="text-indigo-600 dark:text-indigo-400"/> {t('upsell.founder.feat3')}</li>
                       </ul>
                       
                       <div className="pt-2 flex gap-3">
                           <button onClick={() => onNavigate('PRICING')} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-indigo-900/20 transition-all">
                               {t('upsell.cta')} <ArrowRight size={14} />
                           </button>
                           <button className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg text-sm font-bold border border-zinc-200 dark:border-zinc-700">
                               {t('upsell.donate')}
                           </button>
                       </div>
                  </div>
              </div>
          </div>
      </div>

      {/* CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              <X size={20} />
            </button>
            
            <form onSubmit={handleCreateProject} className="p-6">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6">{t('dash.new_project')}</h2>
              
              {activeOrgId && (
                  <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 rounded-lg flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
                      <Building2 size={16} />
                      Creating in <strong>{organization?.name}</strong>
                  </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5">{t('dash.field.name')}</label>
                  <input autoFocus type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Campaign 2024" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5">{t('dash.field.client')}</label>
                  <input type="text" required value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Acme Corp" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5">{t('dash.field.desc')}</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-all resize-none h-24 font-medium" />
                </div>
              </div>
              <div className="mt-8 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">{t('cancel')}</button>
                <button type="submit" disabled={isCreating || !name || !client} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">{isCreating && <Loader2 size={14} className="animate-spin" />}{isCreating ? t('loading') : t('dash.new_project')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-200">
                <button onClick={() => setEditingProject(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
                <form onSubmit={handleSubmitEdit} className="p-6">
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-6">{t('edit')}</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5">{t('dash.field.name')}</label>
                            <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 outline-none font-medium" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5">{t('dash.field.client')}</label>
                            <input type="text" required value={editClient} onChange={(e) => setEditClient(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 outline-none font-medium" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5">{t('dash.field.desc')}</label>
                            <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 outline-none resize-none h-24 font-medium" />
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end gap-3">
                        <button type="button" onClick={() => setEditingProject(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">{t('cancel')}</button>
                        <button type="submit" disabled={isSavingEdit} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
                            {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {t('save')}
                        </button>
                    </div>
                </form>
            </div>
          </div>
      )}

      {/* SHARE MODAL */}
      {sharingProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200 p-6">
                <button onClick={() => setSharingProject(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white"><X size={20} /></button>
                <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400"><Share2 size={18} /></div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{t('common.share')}</h2>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 font-medium">{t('pv.share.desc')}</p>
                <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 mb-2">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold mb-1">{t('pv.share.link')}</div>
                    <div className="flex items-center gap-2">
                        <input type="text" readOnly value={`${window.location.origin}?projectId=${sharingProject.id}`} className="bg-transparent flex-1 text-xs text-zinc-600 dark:text-zinc-300 outline-none truncate font-mono" />
                        <button onClick={handleCopyLink} className={`px-3 py-1.5 rounded text-xs transition-all shrink-0 flex items-center gap-1 font-bold ${isCopied ? 'bg-green-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'}`}>
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}{isCopied ? t('common.copied') : t('common.copy')}
                        </button>
                    </div>
                </div>
            </div>
          </div>
      )}
    </>
  );
};
