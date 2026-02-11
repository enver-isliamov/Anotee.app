
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Project, ProjectAsset, Comment, CommentStatus, User } from '../types';
import { Play, Pause, ChevronLeft, Send, CheckCircle, Search, Mic, MicOff, Trash2, Pencil, Save, X as XIcon, Layers, FileVideo, Upload, CheckSquare, Flag, Columns, Monitor, RotateCcw, RotateCw, Maximize, Minimize, MapPin, Gauge, GripVertical, Download, FileJson, FileSpreadsheet, FileText, MoreHorizontal, Film, AlertTriangle, Cloud, CloudOff, Loader2, HardDrive, Lock, Unlock, Clapperboard, ChevronRight, CornerUpLeft, SplitSquareHorizontal, ChevronDown, FileAudio, Sparkles, MessageSquare, List, Link, History, Bot, Wand2, Settings2, ShieldAlert, Server } from 'lucide-react';
import { generateEDL, generateCSV, generateResolveXML, downloadFile } from '../services/exportService';
import { generateId, stringToColor } from '../services/utils';
import { ToastType } from './Toast';
import { useLanguage } from '../services/i18n';
import { extractAudioFromUrl } from '../services/audioUtils';
import { GoogleDriveService } from '../services/googleDrive';
import { api } from '../services/apiClient';
import { useOrganization, useAuth } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';

interface PlayerProps {
  asset: ProjectAsset;
  project: Project;
  currentUser: User;
  onBack: () => void;
  users: User[];
  onUpdateProject: (project: Project, skipSync?: boolean) => void;
  isSyncing: boolean;
  notify: (msg: string, type: ToastType) => void;
  isDemo?: boolean;
  isMockMode?: boolean;
}

const VALID_FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120];

const TRANSCRIBE_LANGUAGES = [
    { code: 'auto', label: 'Auto-Detect' },
    { code: 'en', label: 'English' },
    { code: 'ru', label: 'Russian' },
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'it', label: 'Italian' },
    { code: 'ja', label: 'Japanese' },
    { code: 'zh', label: 'Chinese' },
];

const TRANSCRIBE_MODELS = [
    { id: 'Xenova/whisper-tiny', label: 'Fast (Tiny)' },
    { id: 'Xenova/whisper-base', label: 'Balanced (Base)' },
];

interface TranscriptChunk {
    text: string;
    timestamp: [number, number] | null; 
}

// --- OPTIMIZATION: Memoized Sidebar Component with Mobile Gestures ---
const PlayerSidebar = React.memo(({ 
    sidebarTab, setSidebarTab, filteredComments, isManager, version, 
    handleToggleLock, setShowExportMenu, showExportMenu, handleExport, handleBulkResolve,
    currentUser, currentTime, editingCommentId, selectedCommentId, 
    setSelectedCommentId, videoRef, setVideoError, setPreviousTime, setIsPlaying,
    startEditing, handleDeleteComment, handleResolveComment, editText, setEditText, cancelEdit, saveEdit,
    transcript, isTranscribing, transcribeProgress, transcribeLanguage, setTranscribeLanguage,
    transcribeModel, setTranscribeModel, handleTranscribe, loadingDrive, driveFileMissing, videoError,
    setTranscript, seekByFrame, videoFps, formatTimecode, t
}: any) => {
    
    // Internal Swipe State for this component
    const [swipedCommentId, setSwipedCommentId] = useState<string | null>(null);
    const [swipeOffset, setSwipeOffset] = useState(0);
    const touchStartRef = useRef<{x: number, y: number} | null>(null);

    const handleTouchStart = (e: React.TouchEvent, id: string) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setSwipedCommentId(id);
        setSwipeOffset(0);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const deltaX = e.touches[0].clientX - touchStartRef.current.x;
        const deltaY = e.touches[0].clientY - touchStartRef.current.y;

        // Only allow horizontal swipes, ignore vertical scrolling
        if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            // Cap swipe distance
            const boundedOffset = Math.max(-100, Math.min(100, deltaX));
            setSwipeOffset(boundedOffset);
        }
    };

    const handleTouchEnd = () => {
        if (swipedCommentId) {
            if (swipeOffset > 80) {
                // Swipe Right -> Edit
                const comment = filteredComments.find((c:any) => c.id === swipedCommentId);
                if (comment) startEditing(comment);
            } else if (swipeOffset < -80) {
                // Swipe Left -> Delete
                handleDeleteComment(swipedCommentId);
            }
        }
        setSwipedCommentId(null);
        setSwipeOffset(0);
        touchStartRef.current = null;
    };

    return (
        <div className="w-full lg:w-80 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0 h-[45vh] lg:h-auto z-10 shadow-2xl lg:shadow-none pb-20 lg:pb-0 relative transition-colors">
             <>
                <div className="flex border-b border-zinc-200 dark:border-zinc-800" id="tour-sidebar-tabs">
                    <button 
                        onClick={() => setSidebarTab('comments')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${sidebarTab === 'comments' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-zinc-800/50' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                    >
                        <MessageSquare size={14} /> {t('player.comments')}
                    </button>
                    <button 
                        onClick={() => setSidebarTab('transcript')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${sidebarTab === 'transcript' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-zinc-800/50' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                    >
                        <List size={14} /> Transcript
                    </button>
                </div>
                {sidebarTab === 'comments' && (
                    <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 sticky top-0 z-20">
                        <div className="flex items-center gap-3"><span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total: ({filteredComments.length})</span></div>
                        <div className="flex items-center gap-2">
                            {isManager && (<><button onClick={handleToggleLock} className={`p-1 rounded transition-colors ${version.isLocked ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} title={version.isLocked ? t('player.lock_ver') : t('player.lock_ver')}>{version.isLocked ? <Lock size={14} /> : <Unlock size={14} />}</button><div className="relative"><button id="tour-export-btn" onClick={() => setShowExportMenu(!showExportMenu)} className="p-1 text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors" title={t('player.export.title')}><Download size={14} /></button>{showExportMenu && (<div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100"><button onClick={() => handleExport('xml')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white text-left"><Film size={14} className="text-indigo-500 dark:text-indigo-400" />{t('player.export.xml')}</button><button onClick={() => handleExport('csv')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white text-left"><FileSpreadsheet size={14} className="text-green-500 dark:text-green-400" />{t('player.export.csv')}</button><button onClick={() => handleExport('edl')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white text-left"><FileText size={14} className="text-orange-500 dark:text-orange-400" />{t('player.export.edl')}</button></div>)}{showExportMenu && (<div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)}></div>)}</div></>)}
                            {isManager && filteredComments.some((c: any) => c.status === CommentStatus.OPEN) && (<button onClick={handleBulkResolve} className="flex items-center gap-1 text-[9px] font-bold bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/50 hover:bg-green-200 dark:hover:bg-green-900/40 px-2 py-0.5 rounded transition-colors uppercase"><CheckSquare size={10} />{t('player.resolve_all')}</button>)}
                        </div>
                    </div>
                )}
                
                <div className="flex-1 overflow-y-auto p-3 space-y-2 overflow-x-hidden bg-zinc-50 dark:bg-zinc-950 z-0 relative">
                    {/* ... (Existing comments render logic is unchanged, just wrapping div ID was added above) ... */}
                    {sidebarTab === 'comments' && filteredComments.map((comment: any) => {
                        const isSelected = selectedCommentId === comment.id; const a = {name: comment.authorName || 'User', role: 'Viewer'}; const isCO = comment.userId === currentUser.id; const canR = isManager; const isE = editingCommentId === comment.id; 
                        
                        // Swipe Logic
                        const isS = swipedCommentId === comment.id; 
                        const o = isS ? swipeOffset : 0; 
                        
                        const isA = currentTime >= comment.timestamp && currentTime < (comment.timestamp + (comment.duration || 3)); const cC = stringToColor(comment.userId); const canD = isManager || isCO; const canEd = isCO || (isManager);
                        return (
                        <div key={comment.id} className="relative group/wrapper overflow-hidden" id={`comment-${comment.id}`}>
                             <div className="absolute inset-0 rounded-lg flex items-center justify-between px-4">
                                 <div className="flex items-center text-blue-500 gap-2 font-bold text-xs uppercase transition-opacity duration-200" style={{ opacity: o > 20 ? 1 : 0 }}><Pencil size={16} /> {t('common.edit')}</div>
                                 <div className="flex items-center text-red-500 gap-2 font-bold text-xs uppercase transition-opacity duration-200" style={{ opacity: o < -20 ? 1 : 0 }}>{t('common.delete')} <Trash2 size={16} /></div>
                             </div>
                            
                            <div 
                                onTouchStart={(e) => handleTouchStart(e, comment.id)} 
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                                style={{ transform: `translateX(${o}px)` }} 
                                onClick={() => { if (isE) return; setSelectedCommentId(comment.id); if (videoRef.current && !videoError) { videoRef.current.currentTime = comment.timestamp; setPreviousTime(comment.timestamp); setIsPlaying(false); videoRef.current.pause(); } }} 
                                className={`rounded-lg p-2 border text-xs cursor-pointer transition-transform relative z-10 shadow-sm ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/50' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-zinc-700'} ${isA && !isSelected ? 'border-l-4 border-l-indigo-500 bg-zinc-50 dark:bg-zinc-800 shadow-md ring-1 ring-inset ring-indigo-500/20' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2"><span className="font-bold text-zinc-900 dark:text-zinc-100" style={{ color: cC }}>{a.name.split(' ')[0]}</span><span className={`font-mono text-[10px] px-1 rounded flex items-center gap-1 ${isA ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-500/30' : 'text-zinc-400 dark:text-zinc-500'}`}>{formatTimecode(comment.timestamp)}{comment.duration && <span className="opacity-50">→ {formatTimecode(comment.timestamp + comment.duration)}</span>}</span></div>
                                    <div className="flex items-center gap-1">
                                        {canEd && !isE && (<button onClick={(e) => { e.stopPropagation(); startEditing(comment); }} className="text-zinc-400 hover:text-blue-500 opacity-0 group-hover/wrapper:opacity-100 transition-opacity p-1" title={t('common.edit')}><Pencil size={12} /></button>)}
                                        {canD && !isE && (<button onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); }} className="text-zinc-400 hover:text-red-500 opacity-0 group-hover/wrapper:opacity-100 transition-opacity p-1" title={t('common.delete')}><Trash2 size={12} /></button>)}
                                        {canR && !isE && (<button onClick={(e) => handleResolveComment(e, comment.id)} className={`p-1 ${comment.status==='resolved'?'text-green-500':'text-zinc-300 hover:text-green-500'}`}><CheckCircle size={12} /></button>)}
                                        {!canR && !isE && (<div className={`w-1.5 h-1.5 rounded-full mx-1 ${comment.status==='resolved'?'bg-green-500':'bg-yellow-500'}`} />)}
                                    </div>
                                </div>
                                {isE ? (<div className="mt-2" onClick={e => e.stopPropagation()}><textarea className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded p-2 text-xs text-zinc-900 dark:text-white focus:border-indigo-500 outline-none mb-2" value={editText} onChange={e => setEditText(e.target.value)} rows={3} autoFocus /><div className="flex justify-end gap-2"><button onClick={cancelEdit} className="px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">{t('cancel')}</button><button onClick={() => saveEdit(comment.id)} className="px-3 py-1 bg-indigo-600 text-white rounded text-[10px] flex items-center gap-1"><Save size={10} /> {t('save')}</button></div></div>) : (<p className={`text-zinc-700 dark:text-zinc-300 mb-0.5 whitespace-pre-wrap text-xs leading-relaxed ${comment.status === CommentStatus.RESOLVED ? 'line-through opacity-50' : ''}`}>{comment.text}</p>)}
                            </div>
                        </div>);
                    })}

                    {sidebarTab === 'transcript' && (
                        <div className="h-full flex flex-col">
                            {!transcript && !isTranscribing && (
                                <div className="flex flex-col h-full p-4">
                                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                                        <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-center mb-4 text-indigo-500"><Bot size={24} /></div>
                                        <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">AI Transcription</h3>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed max-w-[240px]">Use Client-Side AI to convert speech to text locally.</p>
                                    </div>
                                    <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/30 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">Language</label><div className="relative"><select value={transcribeLanguage} onChange={(e) => setTranscribeLanguage(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs appearance-none outline-none focus:border-indigo-500">{TRANSCRIBE_LANGUAGES.map(lang => (<option key={lang.code} value={lang.code}>{lang.label}</option>))}</select><ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" /></div></div>
                                        <div className="space-y-1"><label className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">Model Quality</label><div className="relative"><select value={transcribeModel} onChange={(e) => setTranscribeModel(e.target.value)} className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-xs appearance-none outline-none focus:border-indigo-500">{TRANSCRIBE_MODELS.map(m => (<option key={m.id} value={m.id}>{m.label}</option>))}</select><Settings2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" /></div></div>
                                        <button onClick={handleTranscribe} disabled={loadingDrive || driveFileMissing || videoError} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"><Wand2 size={14} /> Generate Transcript</button>
                                    </div>
                                </div>
                            )}
                            {isTranscribing && (<div className="flex flex-col items-center justify-center h-64 px-8 text-center"><Loader2 size={32} className="animate-spin text-indigo-500 mb-4" /><div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-1.5 mb-2 overflow-hidden"><div className="bg-indigo-500 h-full transition-all duration-300 ease-out" style={{ width: `${transcribeProgress?.progress || 0}%` }} /></div><p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{transcribeProgress?.status === 'downloading' ? `Loading Model (${Math.round(transcribeProgress.progress)}%)` : 'Processing Audio...'}</p></div>)}
                            {transcript && transcript.length > 0 && (<div className="flex-1 overflow-y-auto p-2 space-y-1"><div className="px-2 py-1 text-[10px] text-zinc-500 uppercase font-bold border-b border-zinc-200 dark:border-zinc-800/50 mb-2 flex justify-between"><span>Result</span><button onClick={() => setTranscript(null)} className="hover:text-red-500 transition-colors">Clear</button></div>{transcript.map((chunk: TranscriptChunk, i: number) => { const isActive = chunk.timestamp && currentTime >= chunk.timestamp[0] && currentTime < chunk.timestamp[1]; return (<div key={i} onClick={() => chunk.timestamp && seekByFrame((chunk.timestamp[0] - currentTime) * videoFps)} className={`p-2 rounded-lg text-xs cursor-pointer transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50 ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500 pl-2' : ''}`}><div className="flex gap-2"><span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 mt-0.5">{chunk.timestamp ? formatTimecode(chunk.timestamp[0]) : '--:--'}</span><p className={`text-zinc-700 dark:text-zinc-300 leading-relaxed ${isActive ? 'font-medium text-zinc-900 dark:text-white' : ''}`}>{chunk.text}</p></div></div>); })}</div>)}
                        </div>
                    )}
                </div>
            </>
        </div>
    );
});

// ... (Rest of file unchanged, just export Player) ...
export const Player: React.FC<PlayerProps> = ({ asset, project, currentUser, onBack, users, onUpdateProject, isSyncing, notify, isDemo = false, isMockMode = false }) => {
  const { t } = useLanguage();
  const { organization } = useOrganization();
  const { isPro } = useSubscription();
  const { getToken } = useAuth(); // Needed for Presigned URLs

  const isManager = project.ownerId === currentUser.id || (organization?.id && project.orgId === organization.id);
  const isOwner = project.ownerId === currentUser.id;

  const [currentVersionIdx, setCurrentVersionIdx] = useState(asset.versions.length - 1);
  const [compareVersionIdx, setCompareVersionIdx] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'side-by-side'>('single');
  const [sidebarTab, setSidebarTab] = useState<'comments' | 'transcript'>('comments');

  const version = asset.versions[currentVersionIdx] || asset.versions[0];
  const compareVersion = compareVersionIdx !== null ? asset.versions[compareVersionIdx] : null;
  const isLocked = project.isLocked || version?.isLocked || false;
  
  const [showMobileViewMenu, setShowMobileViewMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoFps, setVideoFps] = useState(30); 
  const [isFpsDetected, setIsFpsDetected] = useState(false);
  const [isVerticalVideo, setIsVerticalVideo] = useState(false);
  
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [driveUrlRetried, setDriveUrlRetried] = useState(false); 
  const [driveFileMissing, setDriveFileMissing] = useState(false); 
  const [drivePermissionError, setDrivePermissionError] = useState(false);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // ... (Other states remain the same) ...
  const [isScrubbing, setIsScrubbing] = useState(false);
  const isDragRef = useRef(false); 
  
  const [isVideoScrubbing, setIsVideoScrubbing] = useState(false);
  const videoScrubRef = useRef<{ startX: number, startTime: number, isDragging: boolean, isPressed: boolean }>({ startX: 0, startTime: 0, isDragging: false, isPressed: false });

  const [controlsPos, setControlsPos] = useState(() => {
    try {
        const saved = localStorage.getItem('anotee_controls_pos');
        return saved ? JSON.parse(saved) : { x: 0, y: 0 };
    } catch {
        return { x: 0, y: 0 };
    }
  });
  const isDraggingControls = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCompareMenu, setShowCompareMenu] = useState(false);
  const [showVersionSelector, setShowVersionSelector] = useState(false);

  const [localFileSrc, setLocalFileSrc] = useState<string | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const localFileRef = useRef<HTMLInputElement>(null);

  const [comments, setComments] = useState<Comment[]>(version?.comments || []);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const [newCommentText, setNewCommentText] = useState('');
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [markerInPoint, setMarkerInPoint] = useState<number | null>(null);
  const [markerOutPoint, setMarkerOutPoint] = useState<number | null>(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const [transcript, setTranscript] = useState<TranscriptChunk[] | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{status: string, progress: number} | null>(null);
  const [transcribeLanguage, setTranscribeLanguage] = useState<string>('auto');
  const [transcribeModel, setTranscribeModel] = useState<string>('Xenova/whisper-tiny');
  const workerRef = useRef<Worker | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const compareVideoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null); 
  const sidebarInputRef = useRef<HTMLInputElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // REFACTORED TIMECODE FORMATTER
  const formatTimecode = (seconds: number) => {
    const fps = videoFps || 30; 
    const totalFrames = Math.floor(seconds * fps);
    const h = Math.floor(totalFrames / (3600 * fps));
    const m = Math.floor((totalFrames % (3600 * fps)) / (60 * fps));
    const s = Math.floor((totalFrames % (60 * fps)) / fps);
    const f = Math.floor(totalFrames % fps);
    const hh = h.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    const ff = f.toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}:${ff}`;
  };

  useEffect(() => {
    localStorage.setItem('anotee_controls_pos', JSON.stringify(controlsPos));
  }, [controlsPos]);

  useEffect(() => {
      return () => {
          if (workerRef.current) {
              workerRef.current.terminate();
              workerRef.current = null;
          }
      };
  }, []);

  // ... (Other event listeners for resize etc) ...

  const handleTranscribe = async () => {
    if (isTranscribing) return;
    const sourceUrl = localFileSrc || driveUrl || version.url;
    if (!sourceUrl) { notify("No video source available", "error"); return; }
    setIsTranscribing(true); setTranscript([]); setTranscribeProgress({ status: 'init', progress: 0 });
    try {
        if (!workerRef.current) {
             workerRef.current = new Worker(new URL('../services/transcriptionWorker.ts', import.meta.url), { type: 'module' });
             workerRef.current.onmessage = (event) => {
                const { type, data, result, error } = event.data;
                if (type === 'download') {
                    if (data.status === 'progress') setTranscribeProgress({ status: 'downloading', progress: data.progress || 0 });
                    else if (data.status === 'done') setTranscribeProgress({ status: 'processing', progress: 0 });
                } else if (type === 'complete') {
                    if (result && Array.isArray(result.chunks)) { setTranscript(result.chunks); notify("Transcription complete", "success"); }
                    setIsTranscribing(false); setTranscribeProgress(null);
                } else if (type === 'error') { console.error("Worker Error:", error); notify(`Transcription Failed: ${error}`, "error"); setIsTranscribing(false); setTranscribeProgress(null); }
             };
        }
        notify("Extracting audio...", "info");
        const isProxy = sourceUrl.includes('drive.google.com') && !localFileSrc;
        const audioData = await extractAudioFromUrl(sourceUrl, isProxy);
        notify(`Starting AI Model...`, "info");
        workerRef.current.postMessage({ type: 'transcribe', audio: audioData, language: transcribeLanguage, model: transcribeModel });
    } catch (e: any) { console.error("Transcribe Error:", e); notify(e.message || "Failed to start", "error"); setIsTranscribing(false); setTranscribeProgress(null); }
  };

  const seekByFrame = (frames: number) => {
      const frameDuration = 1 / videoFps;
      const newTime = Math.min(Math.max(currentTime + (frames * frameDuration), 0), duration);
      setCurrentTime(newTime);
      if (videoRef.current) videoRef.current.currentTime = newTime;
      if (compareVideoRef.current) compareVideoRef.current.currentTime = newTime;
  };

  // Keyboard Shortcuts (Unchanged)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (isLocked) return;
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.tagName === 'SELECT') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        switch (e.code) {
            case 'Space': e.preventDefault(); togglePlay(); break;
            case 'KeyI': setMarkerInPoint(currentTime); if (markerOutPoint !== null && markerOutPoint <= currentTime) setMarkerOutPoint(null); break;
            case 'KeyO': const outTime = currentTime; if (markerInPoint !== null && outTime > markerInPoint) setMarkerOutPoint(outTime); else { if (markerInPoint === null) setMarkerInPoint(Math.max(0, outTime - 5)); setMarkerOutPoint(outTime); } if (isPlaying) togglePlay(); if (isFullscreen) setShowVoiceModal(true); else setTimeout(() => sidebarInputRef.current?.focus(), 100); startListening(); break;
            case 'KeyM': setMarkerInPoint(currentTime); setMarkerOutPoint(null); if (isPlaying) togglePlay(); if (isFullscreen) setShowVoiceModal(true); else setTimeout(() => sidebarInputRef.current?.focus(), 100); startListening(); break;
            case 'ArrowLeft': e.preventDefault(); if (isPlaying) togglePlay(); seekByFrame(-1); break;
            case 'ArrowRight': e.preventDefault(); if (isPlaying) togglePlay(); seekByFrame(1); break;
            case 'KeyJ': seek(-5); break;
            case 'KeyL': seek(5); break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked, isPlaying, currentTime, markerInPoint, markerOutPoint, isFullscreen, videoFps, duration]);

  const togglePlay = () => {
    const s = !isPlaying; setIsPlaying(s); if (s) setSelectedCommentId(null);
    if (videoRef.current) s ? videoRef.current.play().catch(() => setIsPlaying(false)) : videoRef.current.pause();
    if (compareVideoRef.current && viewMode === 'side-by-side') s ? compareVideoRef.current.play().catch(() => {}) : compareVideoRef.current.pause();
  };

  // ... (persistLocalFile, handleLocalFileSelect, syncCommentAction, handleRemoveDeadVersion unchanged) ...
  const persistLocalFile = (url: string, name: string) => { const uV = [...asset.versions]; uV[currentVersionIdx] = { ...uV[currentVersionIdx], localFileUrl: url, localFileName: name }; const uA = project.assets.map(a => a.id === asset.id ? { ...a, versions: uV } : a); onUpdateProject({ ...project, assets: uA }); };
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { if (isDemo) { notify("Local file disabled in Demo.", "info"); return; } if (e.target.files && e.target.files.length > 0) { const file = e.target.files[0]; const url = URL.createObjectURL(file); setLocalFileSrc(url); setLocalFileName(file.name); setVideoError(false); persistLocalFile(url, file.name); notify(t('common.success'), "success"); } };
  
  const syncCommentAction = async (action: 'create' | 'update' | 'delete', payload: any) => { 
      if (action === 'create') setComments(prev => [...prev, { ...payload, userId: currentUser.id, createdAt: 'Just now' }]); 
      else if (action === 'update') setComments(prev => prev.map(c => c.id === payload.id ? { ...c, ...payload } : c)); 
      else if (action === 'delete') setComments(prev => prev.filter(c => c.id !== payload.id)); 
      
      const updatedVersions = [...asset.versions];
      const versionToUpdate = { ...updatedVersions[currentVersionIdx] };
      let newComments = [...(versionToUpdate.comments || [])]; 
      if (action === 'create') newComments.push({ ...payload, userId: currentUser.id, createdAt: 'Just now' }); 
      else if (action === 'update') newComments = newComments.map(c => c.id === payload.id ? { ...c, ...payload } : c); 
      else if (action === 'delete') newComments = newComments.filter(c => c.id !== payload.id); 
      versionToUpdate.comments = newComments; 
      updatedVersions[currentVersionIdx] = versionToUpdate; 
      const updatedAssets = project.assets.map(a => a.id === asset.id ? { ...a, versions: updatedVersions } : a); 
      onUpdateProject({ ...project, assets: updatedAssets }); 
      if (!isDemo && currentUser) await api.comment(project.id, asset.id, version.id, action, payload, currentUser); 
  };

  useEffect(() => { 
      setComments(version?.comments || []); 
  }, [version?.id, version?.comments]);

  const handleRemoveDeadVersion = async () => { if (!confirm("Remove version?")) return; const uV = asset.versions.filter(v => v.id !== version.id); if (uV.length === 0) { onBack(); return; } let newIdx = Math.min(currentVersionIdx, uV.length - 1); if (newIdx < 0) newIdx = 0; const uA = project.assets.map(a => a.id === asset.id ? { ...a, versions: uV, currentVersionIndex: newIdx } : a); setDriveUrl(null); setDriveFileMissing(false); setDrivePermissionError(false); setVideoError(false); setDriveUrlRetried(false); setLoadingDrive(true); setCurrentVersionIdx(newIdx); onUpdateProject({ ...project, assets: uA }); notify("Version removed", "info"); };

  // DRIVE & S3 LOADING (UPDATED)
  useEffect(() => {
    setIsPlaying(false); setCurrentTime(0); setSelectedCommentId(null); setEditingCommentId(null); setMarkerInPoint(null); setMarkerOutPoint(null);
    setVideoError(false); setDriveFileMissing(false); setDrivePermissionError(false); setDriveUrlRetried(false); setDriveUrl(null); setLoadingDrive(false);
    setShowVoiceModal(false); setIsFpsDetected(false); setIsVerticalVideo(false); setTranscript(null);

    const checkRemoteStatus = async () => {
        if (!isMockMode) {
            // S3 PATH
            if (version?.storageType === 's3' && version.s3Key) {
                setLoadingDrive(true);
                try {
                    const token = await getToken();
                    // Get Presigned GET URL
                    const presignRes = await fetch('/api/storage/presign', {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            operation: 'get',
                            key: version.s3Key
                        })
                    });
                    
                    if (presignRes.ok) {
                        const data = await presignRes.json();
                        // If publicUrl is configured (CDN), use it preferentially for better caching
                        if (data.publicUrl) {
                            // Assumes s3Key is cleaned or publicUrl handles slash
                            setDriveUrl(`${data.publicUrl}/${version.s3Key}`);
                        } else {
                            setDriveUrl(data.url);
                        }
                    } else {
                        throw new Error("Failed to sign S3 URL");
                    }
                } catch (e) {
                    console.error("S3 Load Error", e);
                    setVideoError(true);
                } finally {
                    setLoadingDrive(false);
                }
            } 
            // GOOGLE DRIVE PATH
            else if (version?.storageType === 'drive' && version.googleDriveId) {
                setLoadingDrive(true);
                if (isOwner) {
                    const status = await GoogleDriveService.checkFileStatus(version.googleDriveId);
                    if (status !== 'ok') { 
                        setDriveFileMissing(true); 
                        setLoadingDrive(false); 
                        return; 
                    }
                }
                const streamUrl = await GoogleDriveService.getAuthenticatedStreamUrl(version.googleDriveId);
                setDriveUrl(streamUrl);
                setLoadingDrive(false);
            } else if (version?.localFileUrl) { 
                setLocalFileSrc(version.localFileUrl); 
                setLocalFileName(version.localFileName || 'Local File'); 
            } else { 
                setLocalFileSrc(null); setLocalFileName(null); if (version && !version.url) setVideoError(false); 
            }
        } else {
            // Mock Mode Logic
            if (version?.localFileUrl) { setLocalFileSrc(version.localFileUrl); setLocalFileName(version.localFileName || 'Local File'); }
        }
    };
    checkRemoteStatus();
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; videoRef.current.load(); }
  }, [version?.id, isMockMode, isOwner, getToken]); 

  // ... (Rest of Player Handlers, Render logic unchanged) ...
  // Player Handlers
  useEffect(() => { const handleFsChange = () => { const isFs = !!document.fullscreenElement; setIsFullscreen(isFs); if (!isFs) setShowVoiceModal(false); }; document.addEventListener('fullscreenchange', handleFsChange); return () => document.removeEventListener('fullscreenchange', handleFsChange); }, []);
  
  // REAL FRAME RATE DETECTION (Unchanged)
  useEffect(() => {
        if (!isPlaying || isFpsDetected || !videoRef.current) return;
        const video = videoRef.current;
        let handle: number;
        let frameSamples: number[] = [];
        let lastMediaTime = -1;
        const fpsCallback = (now: number, metadata: any) => { 
            const mediaTime = metadata.mediaTime;
            if (lastMediaTime !== -1 && mediaTime > lastMediaTime) {
                const diff = mediaTime - lastMediaTime;
                if (diff > 0) frameSamples.push(diff);
            }
            lastMediaTime = mediaTime;
            if (frameSamples.length >= 30) {
                const avgFrameDuration = frameSamples.reduce((a, b) => a + b, 0) / frameSamples.length;
                const calculatedFps = 1 / avgFrameDuration;
                const closest = VALID_FPS.reduce((prev, curr) => Math.abs(curr - calculatedFps) < Math.abs(prev - calculatedFps) ? curr : prev);
                setVideoFps(closest);
                setIsFpsDetected(true);
            } else {
                if ('requestVideoFrameCallback' in video) handle = (video as any).requestVideoFrameCallback(fpsCallback);
            }
        };
        if ('requestVideoFrameCallback' in video) handle = (video as any).requestVideoFrameCallback(fpsCallback);
        else console.warn("Browser does not support requestVideoFrameCallback. FPS detection disabled.");
        return () => { if ('cancelVideoFrameCallback' in video && handle) (video as any).cancelVideoFrameCallback(handle); };
    }, [isPlaying, isFpsDetected]);
  
  const handleTimeUpdate = () => { if (!isScrubbing && !isVideoScrubbing && videoRef.current) { setCurrentTime(videoRef.current.currentTime); if (viewMode === 'side-by-side' && compareVideoRef.current) { if (Math.abs(compareVideoRef.current.currentTime - videoRef.current.currentTime) > 0.1) { compareVideoRef.current.currentTime = videoRef.current.currentTime; } } } };
  
  const handleFixPermissions = async () => { if (!version.googleDriveId) return; notify("Attempting to make file public...", "info"); const success = await GoogleDriveService.makeFilePublic(version.googleDriveId); if (success) { notify("Permissions fixed! Refreshing...", "success"); setVideoError(false); setDrivePermissionError(false); setDriveUrlRetried(false); const streamUrl = await GoogleDriveService.getAuthenticatedStreamUrl(version.googleDriveId); setDriveUrl(`${streamUrl}&t=${Date.now()}`); } else { notify("Failed to fix permissions. Check Drive settings.", "error"); } };
  const handleVideoError = async () => { 
      if (loadingDrive) return; 
      if (!isMockMode && version.storageType === 'drive' && version.googleDriveId) { 
          if (!driveUrlRetried) { setDriveUrlRetried(true); const fallbackUrl = `https://drive.google.com/uc?export=download&id=${version.googleDriveId}&t=${Date.now()}`; setDriveUrl(fallbackUrl); return; } 
          setLoadingDrive(true); const status = await GoogleDriveService.checkFileStatus(version.googleDriveId); setLoadingDrive(false); if (status !== 'ok') { setDriveFileMissing(true); } else { setDrivePermissionError(true); setVideoError(true); } 
      } else { 
          setVideoError(true); 
      } 
  };
  
  // ... (Timeline scrubbing, video scrubbing, fullscreen, etc unchanged) ...
  const handleTimelinePointerDown = (e: React.PointerEvent) => { isDragRef.current = true; setIsScrubbing(true); if (isPlaying) { setIsPlaying(false); videoRef.current?.pause(); } updateScrubPosition(e); (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const handleTimelinePointerMove = (e: React.PointerEvent) => { if (isDragRef.current) { updateScrubPosition(e); } };
  const updateScrubPosition = (e: React.PointerEvent) => { if (!timelineRef.current || !videoRef.current) return; const rect = timelineRef.current.getBoundingClientRect(); const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width)); const percentage = x / rect.width; const newTime = percentage * duration; setCurrentTime(newTime); videoRef.current.currentTime = newTime; if (compareVideoRef.current) compareVideoRef.current.currentTime = newTime; };
  const handleTimelinePointerUp = (e: React.PointerEvent) => { isDragRef.current = false; setIsScrubbing(false); (e.target as HTMLElement).releasePointerCapture(e.pointerId); };

  const handleVideoDragStart = (e: React.PointerEvent) => { e.preventDefault(); videoScrubRef.current = { startX: e.clientX, startTime: currentTime, isDragging: false, isPressed: true }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const handleVideoDragMove = (e: React.PointerEvent) => { if (!videoScrubRef.current.isPressed) return; const { startX, startTime, isDragging } = videoScrubRef.current; if (!isDragging) { if (Math.abs(e.clientX - startX) > 10) { videoScrubRef.current.isDragging = true; setIsVideoScrubbing(true); if (isPlaying) togglePlay(); } else { return; } } const deltaX = e.clientX - startX; const pixelsPerFrame = 5; const framesMoved = deltaX / pixelsPerFrame; const timeChange = framesMoved * (1 / videoFps); const newTime = Math.max(0, Math.min(duration, startTime + timeChange)); setCurrentTime(newTime); if(videoRef.current) videoRef.current.currentTime = newTime; if (compareVideoRef.current) compareVideoRef.current.currentTime = newTime; };
  const handleVideoDragEnd = (e: React.PointerEvent) => { if (videoScrubRef.current.isPressed && !videoScrubRef.current.isDragging) { togglePlay(); } setIsVideoScrubbing(false); videoScrubRef.current.isDragging = false; videoScrubRef.current.isPressed = false; (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); };

  const toggleFullScreen = () => { if (!document.fullscreenElement) playerContainerRef.current?.requestFullscreen(); else document.exitFullscreen(); };
  const cycleFps = (e: React.MouseEvent) => { e.stopPropagation(); const idx = VALID_FPS.indexOf(videoFps); setVideoFps(idx === -1 ? 24 : VALID_FPS[(idx + 1) % VALID_FPS.length]); setIsFpsDetected(false); };
  const handleDragStart = (e: React.PointerEvent) => { isDraggingControls.current = true; dragStartPos.current = { x: e.clientX - controlsPos.x, y: e.clientY - controlsPos.y }; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const handleDragMove = (e: React.PointerEvent) => { if (isDraggingControls.current) { setControlsPos({ x: e.clientX - dragStartPos.current.x, y: e.clientY - dragStartPos.current.y }); } };
  const handleDragEnd = (e: React.PointerEvent) => { isDraggingControls.current = false; (e.target as HTMLElement).releasePointerCapture(e.pointerId); };
  const seek = (delta: number) => { if (videoRef.current) { const t = Math.min(Math.max(videoRef.current.currentTime + delta, 0), duration); videoRef.current.currentTime = t; setCurrentTime(t); } };
  const handleAddComment = () => { if (!newCommentText.trim()) return; const cId = generateId(); syncCommentAction('create', { id: cId, text: newCommentText, timestamp: markerInPoint !== null ? markerInPoint : currentTime, duration: markerOutPoint && markerInPoint ? markerOutPoint - markerInPoint : undefined, status: CommentStatus.OPEN, authorName: currentUser.name }); setNewCommentText(''); setMarkerInPoint(null); setMarkerOutPoint(null); setTimeout(() => { document.getElementById(`comment-${cId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100); sidebarInputRef.current?.blur(); playerContainerRef.current?.focus(); };
  const handleDeleteComment = (id: string) => { if (confirm(t('pv.delete_asset_confirm'))) syncCommentAction('delete', { id }); };
  const handleResolveComment = (e: React.MouseEvent, id: string) => { e.stopPropagation(); const c = comments.find(c => c.id === id); if (c) syncCommentAction('update', { id, status: c.status === CommentStatus.OPEN ? CommentStatus.RESOLVED : CommentStatus.OPEN }); };
  const startEditing = (comment: Comment) => { setEditingCommentId(comment.id); setEditText(comment.text); };
  const cancelEdit = () => { setEditingCommentId(null); setEditText(''); };
  const saveEdit = (id: string) => { syncCommentAction('update', { id, text: editText }); setEditingCommentId(null); setEditText(''); };
  const handleBulkResolve = () => { comments.filter(c => c.status === CommentStatus.OPEN).forEach(c => syncCommentAction('update', { id: c.id, status: CommentStatus.RESOLVED })); };
  const handleToggleLock = () => { const updatedVersions = [...asset.versions]; const versionToUpdate = { ...updatedVersions[currentVersionIdx] }; versionToUpdate.isLocked = !versionToUpdate.isLocked; updatedVersions[currentVersionIdx] = versionToUpdate; const updatedAssets = project.assets.map(a => a.id === asset.id ? { ...a, versions: updatedVersions } : a); onUpdateProject({ ...project, assets: updatedAssets }); notify(versionToUpdate.isLocked ? t('player.lock_ver') : t('player.unlock_ver'), "info"); };
  const startListening = () => { if (!('webkitSpeechRecognition' in window)) { notify("Speech recognition not supported in this browser.", "error"); return; } const SpeechRecognition = (window as any).webkitSpeechRecognition; recognitionRef.current = new SpeechRecognition(); recognitionRef.current.continuous = false; recognitionRef.current.interimResults = false; recognitionRef.current.lang = 'en-US'; recognitionRef.current.onstart = () => setIsListening(true); recognitionRef.current.onend = () => setIsListening(false); recognitionRef.current.onresult = (event: any) => { const t = event.results[0][0].transcript; setNewCommentText(prev => prev ? `${prev} ${t}` : t); }; recognitionRef.current.start(); };
  const toggleListening = () => { if (isListening) recognitionRef.current?.stop(); else startListening(); };
  const closeVoiceModal = (save: boolean) => { if (save) handleAddComment(); setShowVoiceModal(false); };
  const handleQuickMarker = () => { setMarkerInPoint(currentTime); setMarkerOutPoint(null); handleAddComment(); }; 
  const handleSetInPoint = () => { setMarkerInPoint(currentTime); notify("In Point Set", "info"); };
  const handleSetOutPoint = () => { if (markerInPoint !== null && currentTime > markerInPoint) { setMarkerOutPoint(currentTime); notify("Out Point Set", "info"); } else notify("Out point must be after In point", "error"); };
  const clearMarkers = () => { setMarkerInPoint(null); setMarkerOutPoint(null); };
  
  const handleExport = (format: 'xml' | 'csv' | 'edl') => { 
      if (!isPro && !isDemo) { notify(t('upsell.founder.feat2') + " (Pro Feature)", "warning"); return; }
      let content = ''; let mime = 'text/plain'; let ext = ''; if (format === 'xml') { content = generateResolveXML(project.name, version.versionNumber, comments, videoFps); mime = 'application/xml'; ext = 'xml'; } else if (format === 'csv') { content = generateCSV(comments); mime = 'text/csv'; ext = 'csv'; } else { content = generateEDL(project.name, version.versionNumber, comments, videoFps); mime = 'text/plain'; ext = 'edl'; } downloadFile(`${project.name}_v${version.versionNumber}.${ext}`, content, mime); setShowExportMenu(false); 
  };
  
  const handleSelectCompareVersion = (idx: number | null) => { setCompareVersionIdx(idx); if (idx !== null) setViewMode('side-by-side'); else setViewMode('single'); setShowCompareMenu(false); };
  
  const handleSwitchVersion = (idx: number) => { 
      setDriveUrl(null); setVideoError(false); setDriveFileMissing(false); setDrivePermissionError(false); setDriveUrlRetried(false); setLoadingDrive(true); setCurrentVersionIdx(idx); setShowVersionSelector(false); setSelectedCommentId(null); setEditingCommentId(null);
      if (compareVersionIdx === idx) { setCompareVersionIdx(null); setViewMode('single'); } 
  };

  const filteredComments = comments.filter(c => c.text.toLowerCase().includes(searchQuery.toLowerCase()));
  const activeOverlayComments = comments.filter(c => { const s = c.timestamp; const e = c.duration ? (s + c.duration) : (s + 4); return currentTime >= s && currentTime <= e; });

  const getSourceBadge = () => {
      if (localFileName) return (<div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20"><HardDrive size={10} /> Local</div>);
      if (version?.storageType === 's3' && !isMockMode) return (<div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20"><Server size={10} /> S3</div>);
      if (version?.storageType === 'drive' && !isMockMode) return (<div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"><HardDrive size={10} /> Drive</div>);
      if (isMockMode) return (<div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20"><HardDrive size={10} /> Mock</div>);
      return (<div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20"><Cloud size={10} /> Cloud</div>);
  };

  if (!version) return null; 

  // ... (Render Block Unchanged except using getSourceBadge which is updated above) ...
  return (
    <div className="flex flex-col h-[100dvh] bg-white dark:bg-zinc-950 overflow-hidden select-none fixed inset-0 transition-colors">
      <input type="file" accept=".mp4,.mov,.mkv,.webm,video/mp4,video/quicktime" style={{ display: 'none' }} ref={localFileRef} onChange={handleLocalFileSelect} onClick={(e) => (e.currentTarget.value = '')} />

      {!isFullscreen && (
        <header className="h-auto md:h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900 flex flex-row items-center justify-between px-2 md:px-4 shrink-0 z-50 relative backdrop-blur-md py-2 md:py-0 gap-2">
          {/* Header Content */}
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <button onClick={onBack} className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors border border-zinc-200 dark:border-zinc-700 shrink-0" title={t('back')}><CornerUpLeft size={16} /></button>
            {(!isSearchOpen || window.innerWidth > 768) && (
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-zinc-900 dark:text-zinc-100 leading-tight flex-1 min-w-0">
                   <div className="flex items-center gap-2 max-w-full">
                       <div className="relative group/title min-w-0">
                            <button onClick={() => setShowVersionSelector(!showVersionSelector)} className="flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-1.5 px-3 rounded-lg transition-colors text-left border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 max-w-full">
                                <div className="min-w-0 flex items-center gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-bold text-xs md:text-sm truncate max-w-[200px] md:max-w-[400px] block overflow-hidden text-ellipsis" title={localFileName || version.filename || asset.title}>{localFileName || version.filename || asset.title}</span>
                                        <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md text-[10px] font-bold border border-indigo-100 dark:border-indigo-500/20 shrink-0">v{version.versionNumber} <ChevronDown size={10} /></div>
                                    </div>
                                </div>
                            </button>
                            {showVersionSelector && (
                                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-[100] py-2 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                                    <div className="px-4 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800/50 mb-1">Select Version</div>
                                    {asset.versions.map((v, idx) => {
                                        const isCurrent = idx === currentVersionIdx;
                                        return (
                                            <button key={v.id} onClick={() => handleSwitchVersion(idx)} className={`w-full text-left px-4 py-3 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex justify-between items-center transition-colors group/item ${isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}>
                                                <div className="flex flex-col gap-0.5 overflow-hidden"><div className={`font-bold truncate ${isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-300'}`}>{v.filename || `Version ${v.versionNumber}`}</div><div className="text-[10px] text-zinc-400">{v.uploadedAt}</div></div>
                                                {isCurrent && <CheckCircle size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {showVersionSelector && <div className="fixed inset-0 z-[90]" onClick={() => setShowVersionSelector(false)}></div>}
                       </div>
                       <div className="hidden sm:block">{getSourceBadge()}</div>
                   </div>
                   
                   <div className="flex items-center gap-2">
                       {asset.versions.length > 1 && (
                            <div className="relative hidden md:block">
                                <button onClick={() => setShowCompareMenu(!showCompareMenu)} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors border ${compareVersionIdx !== null ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-transparent hover:border-zinc-300 dark:hover:border-zinc-600'}`}>{compareVersionIdx !== null ? `vs v${compareVersion?.versionNumber}` : 'Compare'} <ChevronDown size={10} /></button>
                                {showCompareMenu && (<div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 py-2"><div className="px-4 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Compare With</div><button onClick={() => handleSelectCompareVersion(null)} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300">None (Single View)</button><div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1"></div>{asset.versions.map((v, idx) => (idx !== currentVersionIdx && (<button key={v.id} onClick={() => handleSelectCompareVersion(idx)} className={`w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 flex justify-between ${compareVersionIdx === idx ? 'text-indigo-600 font-bold' : 'text-zinc-600 dark:text-zinc-300'}`}><span>Version {v.versionNumber}</span>{compareVersionIdx === idx && <CheckCircle size={12} />}</button>)))}</div>)}
                                {showCompareMenu && <div className="fixed inset-0 z-40" onClick={() => setShowCompareMenu(false)}></div>}
                            </div>
                        )}
                       {isSyncing ? <div className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500 animate-pulse text-[10px]" title={t('player.syncing')}><Cloud size={12} /></div> : <div className="flex items-center gap-1 text-green-500 dark:text-green-500/80 text-[10px]" title={t('player.saved')}><CheckCircle size={12} /></div>}
                       <button onClick={(e) => { e.stopPropagation(); localFileRef.current?.click(); }} className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors text-[10px] font-medium cursor-pointer" title={localFileName ? "Replace Local File" : "Link Local File to play without internet"}><Link size={10} /><span className="hidden md:inline">{localFileName ? 'Replace Source' : 'Link File'}</span></button>
                   </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 md:gap-3 shrink-0">
             <div className={`flex items-center transition-all duration-300 ${isSearchOpen ? 'w-32 md:w-56 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2' : 'w-8 justify-end'}`}>
                {isSearchOpen && (<input autoFocus className="w-full bg-transparent text-xs text-zinc-900 dark:text-white outline-none py-1.5" placeholder={t('dash.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onBlur={() => !searchQuery && setIsSearchOpen(false)} />)}
                <button onClick={() => { if (isSearchOpen && searchQuery) setSearchQuery(''); else setIsSearchOpen(!isSearchOpen); }} className={`p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white ${isSearchOpen ? 'text-zinc-900 dark:text-white' : ''}`}>{isSearchOpen && searchQuery ? <XIcon size={16} /> : <Search size={18} />}</button>
             </div>
             <div className="hidden md:block">
                 <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
                 <div className="relative"><button onClick={() => setShowMobileViewMenu(!showMobileViewMenu)} className="p-1.5 md:p-2 rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white">{viewMode === 'single' && <Monitor size={18} />}{viewMode === 'side-by-side' && <SplitSquareHorizontal size={18} />}</button>{showMobileViewMenu && (<div className="absolute top-full right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl p-1 flex flex-col gap-1 z-50 min-w-[120px]" onMouseLeave={() => setShowMobileViewMenu(false)}><button onClick={() => { setViewMode('single'); setShowMobileViewMenu(false); }} className={`flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${viewMode === 'single' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-600 dark:text-zinc-400'}`}><Monitor size={14} /> Single</button><button onClick={() => { setViewMode('side-by-side'); setShowMobileViewMenu(false); }} className={`flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${viewMode === 'side-by-side' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-600 dark:text-zinc-400'}`}><SplitSquareHorizontal size={14} /> Split (Compare)</button></div>)}</div>
             </div>
          </div>
        </header>
      )}

      {/* Body */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
        <div ref={playerContainerRef} className={`flex-1 flex flex-col bg-black lg:border-r border-zinc-800 group/fullscreen overflow-hidden transition-all duration-300 outline-none ${isFullscreen ? 'fixed inset-0 z-[100] w-screen h-screen' : 'relative'}`} tabIndex={-1}>
          {/* ... Video container ... */}
          <div className="flex-1 relative w-full h-full flex items-center justify-center bg-zinc-950 overflow-hidden group/player">
             
             {/* ... Fullscreen button ... */}
             <div className="absolute bottom-4 right-4 z-50 opacity-0 group-hover/player:opacity-100 transition-opacity duration-300">
                <button onClick={() => toggleFullScreen()} className="p-2 bg-black/60 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg backdrop-blur-sm transition-colors shadow-lg" title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>{isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
             </div>
             
             {/* ... Timecode ... */}
             <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-px bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 shadow-lg z-30 select-none overflow-hidden">
                <div className="px-3 py-1 text-white font-mono text-lg tracking-widest">{formatTimecode(currentTime)}</div>
                <div className="h-6 w-px bg-white/20"></div>
                <button onClick={cycleFps} className="px-2 py-1 hover:bg-white/10 transition-colors flex items-center gap-1.5 group/fps" title={t('player.fps')}><span className={`text-[10px] font-mono font-bold ${isFpsDetected ? 'text-indigo-400' : 'text-zinc-400 group-hover/fps:text-zinc-200'}`}>{Number.isInteger(videoFps) ? videoFps : videoFps.toFixed(2)} FPS</span></button>
             </div>

             {/* ... Comments Overlay ... */}
             <div className="absolute bottom-24 lg:bottom-12 left-4 z-20 flex flex-col items-start gap-2 pointer-events-none w-[80%] md:w-[60%] lg:w-[40%]">
                 {activeOverlayComments.map(c => { const cl = stringToColor(c.userId); return (<div key={c.id} className="bg-black/60 text-white px-3 py-1.5 rounded-lg text-sm backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 border border-white/5 shadow-lg max-w-full break-words"><span style={{ color: cl }} className="font-bold mr-2 text-xs uppercase">{c.authorName || 'User'}:</span><span className="text-zinc-100">{c.text}</span></div>); })}
             </div>

             {/* ... Voice Modal ... */}
             {showVoiceModal && isFullscreen && (
                 <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shrink-0 ${isListening ? 'bg-red-500/20 ring-4 ring-red-500/20 scale-110' : 'bg-zinc-800 hover:bg-zinc-700'}`} onClick={toggleListening}><Mic size={20} className={`${isListening ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`} /></div>
                            <div className="flex-1 overflow-hidden">
                                <h3 className="text-sm font-bold text-white mb-1 truncate">{isListening ? t('player.voice.listening') : t('player.voice.transcript')}</h3>
                                <div className="flex items-center gap-2 text-indigo-400 font-mono text-[10px] bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-500/20 w-fit"><span>{formatTimecode(markerInPoint || currentTime)}</span>{markerOutPoint && (<><span>→</span><span>{formatTimecode(markerOutPoint)}</span></>)}</div>
                            </div>
                        </div>
                        <textarea value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} placeholder={isListening ? "Listening..." : "Type comment..."} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:border-indigo-500 outline-none h-20 resize-none" autoFocus />
                        <div className="flex w-full gap-2"><button onClick={() => closeVoiceModal(false)} className="flex-1 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 font-medium transition-colors text-xs">{t('cancel')}</button><button onClick={() => closeVoiceModal(true)} disabled={!newCommentText.trim() || isLocked} className="flex-1 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs">{t('save')}</button></div>
                    </div>
                 </div>
             )}

             {/* ... Play Button / Loaders ... */}
             {!isPlaying && !isScrubbing && !videoError && !showVoiceModal && !driveFileMissing && !loadingDrive && !isVideoScrubbing && (<div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"><div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center shadow-xl animate-in fade-in zoom-in duration-200">{isPlaying ? <Pause size={32} fill="white" className="text-white"/> : <Play size={32} fill="white" className="ml-1 text-white" />}</div></div>)}
             {loadingDrive && (<div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"><Loader2 size={48} className="animate-spin text-white/50"/></div>)}

             {/* ... Errors ... */}
             {videoError && !driveFileMissing && (
                 <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 text-center animate-in fade-in duration-300">
                    <div className="bg-zinc-800 p-4 rounded-full mb-4 ring-1 ring-zinc-700">
                        {drivePermissionError ? <ShieldAlert size={32} className="text-orange-500" /> : <FileVideo size={32} className="text-zinc-400" />}
                    </div>
                    <p className="text-zinc-300 font-bold text-lg mb-2">{drivePermissionError ? "Access Restricted" : t('player.media_offline')}</p>
                    <p className="text-xs text-zinc-500 max-w-[280px] mb-6 leading-relaxed">{drivePermissionError ? "You need public access to view this Drive file in the player." : t('player.offline_desc')}</p>
                    {drivePermissionError && isManager && (<button onClick={(e) => { e.stopPropagation(); handleFixPermissions(); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm shadow-lg shadow-indigo-900/20 cursor-pointer mb-2"><Unlock size={16} /> Fix Permissions (Make Public)</button>)}
                    <button onClick={(e) => { e.stopPropagation(); localFileRef.current?.click(); }} className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm border border-zinc-700 cursor-pointer"><Upload size={16} /> {t('player.link_local')}</button>
                 </div>
             )}

             {driveFileMissing && (
                 <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-md p-6 text-center animate-in fade-in duration-300">
                     <div className="bg-red-900/50 p-4 rounded-full mb-4 ring-1 ring-red-700/50 text-red-300"><Trash2 size={32} /></div>
                     <h3 className="text-xl font-bold text-white mb-2">File Deleted from Drive</h3>
                     <p className="text-sm text-zinc-300 max-w-sm mb-6 leading-relaxed">The source file for <strong>Version {version.versionNumber}</strong> was removed from Google Drive.</p>
                     <div className="flex gap-3">
                         {isManager && (<button onClick={handleRemoveDeadVersion} className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-colors">Remove Version from App</button>)}
                         <button onClick={onBack} className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm border border-zinc-700 transition-colors">Go Back</button>
                     </div>
                 </div>
             )}

             {/* ... Video Element ... */}
             <div className={`relative w-full h-full flex items-center justify-center bg-black ${viewMode === 'side-by-side' ? 'grid grid-cols-2 gap-1' : ''}`}>
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    {viewMode === 'side-by-side' && <div className="absolute top-4 left-4 z-10 bg-black/60 text-white px-2 py-1 rounded text-xs font-bold pointer-events-none">v{version.versionNumber}</div>}
                    <video key={version.id} ref={videoRef} src={localFileSrc || driveUrl || version.url} className="w-full h-full object-contain pointer-events-none" onTimeUpdate={handleTimeUpdate} onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setVideoError(false); setIsFpsDetected(false); setIsVerticalVideo(e.currentTarget.videoHeight > e.currentTarget.videoWidth); }} onError={handleVideoError} onEnded={() => setIsPlaying(false)} playsInline controls={false} />
                </div>
                {viewMode === 'side-by-side' && compareVersion && (<div className="relative w-full h-full flex items-center justify-center overflow-hidden border-l border-zinc-800"><div className="absolute top-4 right-4 z-10 bg-black/60 text-indigo-400 px-2 py-1 rounded text-xs font-bold pointer-events-none">v{compareVersion.versionNumber}</div><video ref={compareVideoRef} src={compareVersion.url} className="w-full h-full object-contain pointer-events-none" muted playsInline controls={false} /></div>)}
                <div className={`absolute inset-0 z-30 touch-none ${isVideoScrubbing ? 'cursor-grabbing' : 'cursor-default hover:cursor-grab'}`} onPointerDown={handleVideoDragStart} onPointerMove={handleVideoDragMove} onPointerUp={handleVideoDragEnd} onPointerLeave={handleVideoDragEnd}></div>
             </div>
          </div>

          <div className={`${isVerticalVideo ? 'absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black via-black/80 to-transparent pb-6 pt-10' : 'bg-zinc-900 border-t border-zinc-800 pb-2'} p-2 lg:p-4 shrink-0 transition-transform duration-300`}>
             <div className="relative h-8 md:h-8 group cursor-pointer flex items-center touch-none" ref={timelineRef} onPointerDown={handleTimelinePointerDown} onPointerMove={handleTimelinePointerMove} onPointerUp={handleTimelinePointerUp} onPointerLeave={handleTimelinePointerUp}>
                <div className="w-full h-2 md:h-1.5 bg-zinc-700/50 rounded-full overflow-hidden relative"><div className="h-full bg-indigo-500" style={{ width: `${(currentTime / duration) * 100}%` }} /></div>
                {filteredComments.map(c => { const l = (c.timestamp / duration) * 100; const w = c.duration ? (c.duration / duration) * 100 : 0.5; const cl = stringToColor(c.userId); return (<div key={c.id} className={`absolute top-1/2 -translate-y-1/2 h-4 md:h-2.5 rounded-sm z-10 opacity-80 pointer-events-none`} style={{ left: `${l}%`, width: `${Math.max(0.5, w)}%`, minWidth: '4px', backgroundColor: c.status === 'resolved' ? '#22c55e' : cl }} />); })}
             </div>
          </div>
        </div>

        {!isFullscreen && (
            <PlayerSidebar 
                sidebarTab={sidebarTab} setSidebarTab={setSidebarTab} filteredComments={filteredComments} isManager={isManager}
                version={version} handleToggleLock={handleToggleLock} setShowExportMenu={setShowExportMenu} showExportMenu={showExportMenu}
                handleExport={handleExport} handleBulkResolve={handleBulkResolve} currentUser={currentUser} currentTime={currentTime}
                editingCommentId={editingCommentId} selectedCommentId={selectedCommentId} 
                setSelectedCommentId={setSelectedCommentId} videoRef={videoRef} setVideoError={setVideoError} setPreviousTime={setCurrentTime}
                setIsPlaying={setIsPlaying} startEditing={startEditing} handleDeleteComment={handleDeleteComment} handleResolveComment={handleResolveComment}
                editText={editText} setEditText={setEditText} cancelEdit={cancelEdit} saveEdit={saveEdit}
                transcript={transcript} isTranscribing={isTranscribing} transcribeProgress={transcribeProgress} transcribeLanguage={transcribeLanguage}
                setTranscribeLanguage={setTranscribeLanguage} transcribeModel={transcribeModel} setTranscribeModel={setTranscribeModel}
                handleTranscribe={handleTranscribe} loadingDrive={loadingDrive} driveFileMissing={driveFileMissing} videoError={videoError}
                setTranscript={setTranscript} seekByFrame={seekByFrame} videoFps={videoFps} formatTimecode={formatTimecode} t={t}
            />
        )}

        {!isFullscreen && sidebarTab === 'comments' && (
            <div className="fixed bottom-0 left-0 right-0 lg:left-auto lg:right-0 lg:w-80 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 z-50 p-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
                {(markerInPoint !== null || markerOutPoint !== null) && (<div className="flex items-center gap-2 mb-2 px-1"><div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/20 uppercase"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div><span>Range: {formatTimecode(markerInPoint || currentTime)} - {markerOutPoint ? formatTimecode(markerOutPoint) : '...'}</span></div></div>)}
                <div className="flex gap-2 items-center" id="tour-comment-input">
                    <div className="relative flex-1">
                        <input ref={sidebarInputRef} disabled={isLocked} className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-3 pr-8 py-3 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all" placeholder={isLocked ? "Comments locked" : (isListening ? t('player.voice.listening') : t('player.voice.placeholder'))} value={newCommentText} onChange={e => setNewCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment()} onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300); }} />
                        <button onClick={toggleListening} disabled={isLocked} className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-white disabled:opacity-30'}`}>{isListening ? <MicOff size={16} /> : <Mic size={16} />}</button>
                    </div>
                    <button onClick={handleAddComment} disabled={!newCommentText.trim() || isLocked} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-3 rounded-lg transition-colors shrink-0 disabled:cursor-not-allowed shadow-sm"><Send size={16} /></button>
                </div>
            </div>
        )}
      </div>

      <div className="fixed z-[9999] floating-controls touch-none transition-all duration-300" style={{ transform: `translate(${controlsPos.x}px, ${controlsPos.y}px)`, bottom: 'calc(80px + env(safe-area-inset-bottom))', right: '16px', left: 'auto' }}>
        <div className={`flex flex-col md:flex-row items-center gap-2 md:gap-1 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md rounded-xl p-2 md:p-1.5 border border-zinc-200 dark:border-zinc-800 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 transition-opacity ${isLocked ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <div onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 md:mr-1 pointer-events-auto"><GripVertical size={14} /></div>
            
            <div className="flex items-center gap-1">
                <button onClick={handleQuickMarker} className="w-10 h-10 md:w-auto md:h-auto flex items-center justify-center text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title={t('player.marker.quick')}><MapPin size={20} /></button>
                <button onClick={(e) => { e.stopPropagation(); seek(-5); }} className="w-10 h-10 md:w-auto md:h-auto flex items-center justify-center text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors pointer-events-auto"><RotateCcw size={20} /></button>
                <div className="hidden md:block w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-0.5"></div>
                <button onClick={(e) => { e.stopPropagation(); seek(5); }} className="w-10 h-10 md:w-auto md:h-auto flex items-center justify-center text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors pointer-events-auto"><RotateCw size={20} /></button>
            </div>

            <div className="flex items-center gap-1 w-full md:w-auto justify-center">
                <button onClick={handleSetInPoint} className={`flex-1 md:flex-none text-xs font-bold px-3 py-2 md:py-1.5 rounded-lg transition-all border border-transparent ${markerInPoint !== null ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-zinc-100 dark:bg-zinc-800 md:bg-transparent'}`} title={t('player.marker.in')}>IN</button>
                <button onClick={handleSetOutPoint} className={`flex-1 md:flex-none text-xs font-bold px-3 py-2 md:py-1.5 rounded-lg transition-all border border-transparent ${markerOutPoint !== null ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-zinc-100 dark:bg-zinc-800 md:bg-transparent'}`} title={t('player.marker.out')}>OUT</button>
                {(markerInPoint !== null || markerOutPoint !== null) && (<button onClick={clearMarkers} className="ml-1 p-2 md:p-1.5 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"><XIcon size={16} /></button>)}
            </div>
        </div>
      </div>
    </div>
  );
};
