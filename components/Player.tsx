
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Project, ProjectAsset, Comment, CommentStatus, User, UserRole } from '../types';
import { Play, Pause, ChevronLeft, Send, CheckCircle, Search, Mic, MicOff, Trash2, Pencil, Save, X as XIcon, Layers, FileVideo, Upload, CheckSquare, Flag, Columns, Monitor, RotateCcw, RotateCw, Maximize, Minimize, MapPin, Gauge, GripVertical, Download, FileJson, FileSpreadsheet, FileText, MoreHorizontal, Film, AlertTriangle, Cloud, CloudOff, Loader2, HardDrive, Lock, Unlock, Clapperboard, ChevronRight, CornerUpLeft, SplitSquareHorizontal, ChevronDown, FileAudio, Sparkles, MessageSquare, List, Link, History } from 'lucide-react';
import { generateEDL, generateCSV, generateResolveXML, downloadFile } from '../services/exportService';
import { generateId, stringToColor } from '../services/utils';
import { ToastType } from './Toast';
import { useLanguage } from '../services/i18n';
import { extractAudioFromUrl } from '../services/audioUtils';
import { GoogleDriveService } from '../services/googleDrive';

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
}

const VALID_FPS = [23.976, 24, 25, 29.97, 30, 50, 60];

const canManageProject = (user: User, project: Project) => {
    if (user.role === UserRole.GUEST) return false;
    const isOwner = project.ownerId === user.id;
    const isTeamMember = project.team.some(m => m.id === user.id);
    return isOwner || isTeamMember;
};

// Interface for Transcript Items
interface TranscriptChunk {
    text: string;
    timestamp: [number, number] | null; // start, end
}

export const Player: React.FC<PlayerProps> = ({ asset, project, currentUser, onBack, users, onUpdateProject, isSyncing, notify, isDemo = false }) => {
  const { t } = useLanguage();
  const [currentVersionIdx, setCurrentVersionIdx] = useState(asset.currentVersionIndex);
  
  // COMPARISON STATE
  const [compareVersionIdx, setCompareVersionIdx] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'side-by-side'>('single');

  // TAB STATE
  const [sidebarTab, setSidebarTab] = useState<'comments' | 'transcript'>('comments');

  // Safely get current version
  const version = asset.versions[currentVersionIdx] || asset.versions[0];
  const compareVersion = compareVersionIdx !== null ? asset.versions[compareVersionIdx] : null;
  
  // Project-level lock takes precedence, then Version-level lock
  const isLocked = project.isLocked || version?.isLocked || false;
  const isGuest = currentUser.role === UserRole.GUEST;
  
  // View State
  const [showMobileViewMenu, setShowMobileViewMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Video State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoFps, setVideoFps] = useState(30); 
  const [isFpsDetected, setIsFpsDetected] = useState(false);
  const [isVerticalVideo, setIsVerticalVideo] = useState(false);
  
  // Loading & Error States
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [driveUrlRetried, setDriveUrlRetried] = useState(false); 
  const [driveFileMissing, setDriveFileMissing] = useState(false); 
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Scrubbing State
  const [isScrubbing, setIsScrubbing] = useState(false);
  const scrubStartDataRef = useRef<{ x: number, time: number, wasPlaying: boolean } | null>(null);
  const isDragRef = useRef(false); 
  
  // Floating Controls State (Persisted)
  const [controlsPos, setControlsPos] = useState(() => {
    try {
        const saved = localStorage.getItem('smotree_controls_pos');
        return saved ? JSON.parse(saved) : { x: 0, y: 0 };
    } catch {
        return { x: 0, y: 0 };
    }
  });
  const isDraggingControls = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Export & Version Menus
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCompareMenu, setShowCompareMenu] = useState(false);
  const [showVersionSelector, setShowVersionSelector] = useState(false);

  // Local File Fallback State
  const [localFileSrc, setLocalFileSrc] = useState<string | null>(null);
  const [localFileName, setLocalFileName] = useState<string | null>(null);
  const localFileRef = useRef<HTMLInputElement>(null);

  // Comments & Local State
  const [comments, setComments] = useState<Comment[]>(version?.comments || []);
  const [swipeCommentId, setSwipeCommentId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartRef = useRef<{x: number, y: number} | null>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Comment Creation & Editing State
  const [newCommentText, setNewCommentText] = useState('');
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  
  // Voice Modal State
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  
  // Range Marker State
  const [markerInPoint, setMarkerInPoint] = useState<number | null>(null);
  const [markerOutPoint, setMarkerOutPoint] = useState<number | null>(null);

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // TRANSCRIPTION STATE
  const [transcript, setTranscript] = useState<TranscriptChunk[] | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{status: string, progress: number} | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const compareVideoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null); 
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const sidebarInputRef = useRef<HTMLInputElement>(null);
  
  const animationFrameRef = useRef<number | null>(null);
  const fpsDetectionRef = useRef<{ frames: number[], lastTime: number, active: boolean }>({ frames: [], lastTime: 0, active: false });

  const isManager = canManageProject(currentUser, project);

  const formatTimecode = (seconds: number) => {
    const fps = videoFps;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * fps);

    const hh = h.toString().padStart(2, '0');
    const mm = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    const ff = f.toString().padStart(2, '0');

    return `${hh}:${mm}:${ss}:${ff}`;
  };

  // --- SAVE FLOATING POS ---
  useEffect(() => {
    localStorage.setItem('smotree_controls_pos', JSON.stringify(controlsPos));
  }, [controlsPos]);

  // --- WORKER SETUP ---
  useEffect(() => {
      // Clean up worker on unmount
      return () => {
          workerRef.current?.terminate();
      };
  }, []);

  // Helper for precise seeking
  const seekByFrame = (frames: number) => {
      const frameDuration = 1 / videoFps;
      const newTime = Math.min(Math.max(currentTime + (frames * frameDuration), 0), duration);
      
      setCurrentTime(newTime);
      if (videoRef.current) videoRef.current.currentTime = newTime;
      if (compareVideoRef.current) compareVideoRef.current.currentTime = newTime;
  };

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (isLocked) return;
        
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                togglePlay();
                break;
            case 'KeyI':
                setMarkerInPoint(currentTime);
                if (markerOutPoint !== null && markerOutPoint <= currentTime) setMarkerOutPoint(null);
                break;
            case 'KeyO':
                const outTime = currentTime;
                if (markerInPoint !== null && outTime > markerInPoint) setMarkerOutPoint(outTime);
                else {
                    if (markerInPoint === null) setMarkerInPoint(Math.max(0, outTime - 5));
                    setMarkerOutPoint(outTime);
                }
                if (isPlaying) togglePlay();
                if (isFullscreen) setShowVoiceModal(true);
                else setTimeout(() => sidebarInputRef.current?.focus(), 100);
                startListening();
                break;
            case 'KeyM':
                setMarkerInPoint(currentTime);
                setMarkerOutPoint(null);
                if (isPlaying) togglePlay();
                if (isFullscreen) setShowVoiceModal(true);
                else setTimeout(() => sidebarInputRef.current?.focus(), 100);
                startListening();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (isPlaying) togglePlay(); 
                seekByFrame(-1);
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (isPlaying) togglePlay(); 
                seekByFrame(1);
                break;
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

  const persistLocalFile = (url: string, name: string) => {
    const uV = [...asset.versions];
    uV[currentVersionIdx] = { ...uV[currentVersionIdx], localFileUrl: url, localFileName: name };
    const uA = project.assets.map(a => a.id === asset.id ? { ...a, versions: uV } : a);
    let uT = project.team; if (!uT.some(u => u.id === currentUser.id)) uT = [...uT, currentUser];
    onUpdateProject({ ...project, assets: uA, team: uT });
  };

  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDemo) { notify("Local file linking disabled in Demo.", "info"); return; }
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0]; const url = URL.createObjectURL(file);
        setLocalFileSrc(url); setLocalFileName(file.name); setVideoError(false); persistLocalFile(url, file.name); notify(t('common.success'), "success");
    }
  };

  const syncCommentAction = async (action: 'create' | 'update' | 'delete', payload: any) => { 
      // Update local state first (Optimistic UI)
      if (action === 'create') {
          setComments(prev => [...prev, { ...payload, userId: currentUser.id, createdAt: 'Just now' }]);
      } else if (action === 'update') {
          setComments(prev => prev.map(c => c.id === payload.id ? { ...c, ...payload } : c));
      } else if (action === 'delete') {
          setComments(prev => prev.filter(c => c.id !== payload.id));
      }

      // Sync with parent project state
      const updatedVersions = [...asset.versions];
      const versionToUpdate = updatedVersions[currentVersionIdx];
      
      let newComments = [...(versionToUpdate.comments || [])];
      
      if (action === 'create') {
          newComments.push({ ...payload, userId: currentUser.id, createdAt: 'Just now' });
      } else if (action === 'update') {
          newComments = newComments.map(c => c.id === payload.id ? { ...c, ...payload } : c);
      } else if (action === 'delete') {
          newComments = newComments.filter(c => c.id !== payload.id);
      }
      
      versionToUpdate.comments = newComments;
      updatedVersions[currentVersionIdx] = versionToUpdate;
      
      const updatedAssets = project.assets.map(a => a.id === asset.id ? { ...a, versions: updatedVersions } : a);
      onUpdateProject({ ...project, assets: updatedAssets });

      // If online, call API
      if (!isDemo && currentUser) {
          try {
             const token = localStorage.getItem('smotree_auth_token');
             await fetch('/api/comment', {
                 method: 'POST',
                 headers: { 
                     'Content-Type': 'application/json',
                     ...(token ? { 'Authorization': `Bearer ${token}` } : { 'X-Guest-ID': currentUser.id })
                 },
                 body: JSON.stringify({
                     projectId: project.id,
                     assetId: asset.id,
                     versionId: version.id,
                     action,
                     payload
                 })
             });
          } catch (e) { console.error("Comment Sync Error", e); }
      }
  };

  useEffect(() => { setComments(version?.comments || []); }, [version?.comments]);

  // Handle Removal of Dead Version
  const handleRemoveDeadVersion = async () => {
      if (!confirm("Are you sure you want to remove this version from the project history? This cannot be undone.")) return;
      
      const uV = asset.versions.filter(v => v.id !== version.id);
      if (uV.length === 0) {
          onBack();
          return;
      }
      
      // Calculate new index - ensure it points to the LAST available version (usually most recent)
      // or keep current if valid. Since we removed one, length decreased.
      let newIdx = Math.min(currentVersionIdx, uV.length - 1);
      if (newIdx < 0) newIdx = 0;

      // Update Project Data
      const uA = project.assets.map(a => a.id === asset.id ? { ...a, versions: uV, currentVersionIndex: newIdx } : a);
      
      // CRITICAL: Reset ALL error states for the new version load BEFORE triggering update
      setDriveUrl(null); 
      setDriveFileMissing(false);
      setVideoError(false);
      setDriveUrlRetried(false);
      setLoadingDrive(true); // Show loading while next one preps
      
      // Set new index to trigger reload
      setCurrentVersionIdx(newIdx);
      
      onUpdateProject({ ...project, assets: uA });
      notify("Version removed", "info");
  };

  useEffect(() => {
    // NOTIFY USER ON VERSION LOAD
    if (version) {
        // notify(`Loaded Version ${version.versionNumber}: ${version.filename || 'Video'}`, "success"); // Removed to reduce noise on switch
    }

    setIsPlaying(false); setCurrentTime(0); setSelectedCommentId(null);
    setEditingCommentId(null); setMarkerInPoint(null); setMarkerOutPoint(null);
    
    // STRICT RESET OF ERROR STATES ON VERSION CHANGE
    setVideoError(false); 
    setDriveFileMissing(false);
    setDriveUrlRetried(false); // Reset Retry Flag
    setDriveUrl(null); 
    setLoadingDrive(false);
    
    setShowVoiceModal(false); setIsFpsDetected(false); setIsVerticalVideo(false);
    setTranscript(null);

    const checkDriveStatus = async () => {
        if (version?.storageType === 'drive' && version.googleDriveId) {
            setLoadingDrive(true);
            // Check existence first
            const status = await GoogleDriveService.checkFileStatus(version.googleDriveId);
            if (status !== 'ok') {
                console.warn(`File ${version.googleDriveId} is ${status}`);
                setDriveFileMissing(true);
                setLoadingDrive(false);
                return;
            }

            // Fetch stream URL
            const streamUrl = GoogleDriveService.getVideoStreamUrl(version.googleDriveId);
            // Trust URL initially
            setDriveUrl(streamUrl);
            setLoadingDrive(false);
        } else if (version?.localFileUrl) { 
            setLocalFileSrc(version.localFileUrl); 
            setLocalFileName(version.localFileName || 'Local File'); 
        } else { 
            setLocalFileSrc(null); 
            setLocalFileName(null); 
            if (version && !version.url) setVideoError(false); // Waiting for URL
        }
    };

    checkDriveStatus();

    // Force reset Video Element specifically
    if (videoRef.current) { 
        videoRef.current.pause();
        videoRef.current.currentTime = 0; 
        videoRef.current.load(); 
    }
  }, [version?.id]); // CRITICAL: version.id changes -> everything reloads

  useEffect(() => {
    const handleFsChange = () => { const isFs = !!document.fullscreenElement; setIsFullscreen(isFs); if (!isFs) setShowVoiceModal(false); };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const startFpsDetection = () => { if (isFpsDetected) return; fpsDetectionRef.current = { frames: [], lastTime: performance.now(), active: true }; };

  const updateTimeLoop = useCallback(() => { 
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (fpsDetectionRef.current.active) {
          const now = performance.now(); const delta = now - fpsDetectionRef.current.lastTime;
          fpsDetectionRef.current.lastTime = now;
          if (delta > 5 && delta < 100) fpsDetectionRef.current.frames.push(delta);
          if (fpsDetectionRef.current.frames.length > 30) {
              const avg = fpsDetectionRef.current.frames.reduce((a, b) => a + b, 0) / fpsDetectionRef.current.frames.length;
              const est = 1000 / avg;
              const closest = VALID_FPS.reduce((p, c) => Math.abs(c - est) < Math.abs(p - est) ? c : p);
              setVideoFps(closest); setIsFpsDetected(true); fpsDetectionRef.current.active = false;
          }
      }
      if (viewMode === 'side-by-side' && compareVideoRef.current) {
         if (Math.abs(compareVideoRef.current.currentTime - videoRef.current.currentTime) > 0.1) compareVideoRef.current.currentTime = videoRef.current.currentTime;
      }
    }
    animationFrameRef.current = requestAnimationFrame(updateTimeLoop);
  }, [isFpsDetected, viewMode]);

  useEffect(() => {
    if (isPlaying) { animationFrameRef.current = requestAnimationFrame(updateTimeLoop); if (!isFpsDetected) startFpsDetection(); } 
    else { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); fpsDetectionRef.current.active = false; }
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isPlaying, updateTimeLoop, isFpsDetected]);

  // Handler functions (omitted for brevity as they remain unchanged)
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = parseFloat(e.target.value); setCurrentTime(t);
      if (videoRef.current) videoRef.current.currentTime = t;
      if (compareVideoRef.current) compareVideoRef.current.currentTime = t;
  };

  const handleTimeUpdate = () => { if (!isScrubbing) setCurrentTime(videoRef.current?.currentTime || 0); };
  
  const handleVideoError = () => {
      // Avoid flickering error if we are just loading
      if (loadingDrive) return;

      if (!localFileSrc && !driveFileMissing) {
          // Attempt Drive Fallback Logic (Auto-Fallback)
          if (version.storageType === 'drive' && version.googleDriveId && !driveUrlRetried) {
              console.warn("Primary API link failed (likely CORS). Switching to UC fallback link...");
              setDriveUrlRetried(true);
              setDriveUrl(`https://drive.google.com/uc?export=download&id=${version.googleDriveId}`);
              
              // Force retry in the video element
              setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.load();
                    // Optionally auto-play if it was meant to be playing
                    if (isPlaying) videoRef.current.play().catch(() => {});
                }
              }, 100);
          } else {
              setVideoError(true);
          }
      }
  };
  
  // -- RE-IMPLEMENTED PRECISE SCRUBBING LOGIC (Frame Accurate) --
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragRef.current = false;
    scrubStartDataRef.current = {
        x: e.clientX,
        time: currentTime,
        wasPlaying: isPlaying
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      // Trigger drag state if moved more than 5 pixels
      if (!isDragRef.current && scrubStartDataRef.current && Math.abs(e.clientX - scrubStartDataRef.current.x) > 5) {
          isDragRef.current = true;
          setIsScrubbing(true);
          if (isPlaying) {
              setIsPlaying(false);
              videoRef.current?.pause();
          }
      }

      if (isDragRef.current && scrubStartDataRef.current && videoRef.current) {
          const deltaX = e.clientX - scrubStartDataRef.current.x;
          const pixelsPerFrame = 25; 
          const framesMoved = deltaX / pixelsPerFrame;
          const frameDuration = 1 / videoFps; 
          const deltaT = framesMoved * frameDuration;
          const newTime = Math.max(0, Math.min(duration, scrubStartDataRef.current.time + deltaT));
          
          videoRef.current.currentTime = newTime;
          setCurrentTime(newTime);
          if (compareVideoRef.current) compareVideoRef.current.currentTime = newTime;
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (isDragRef.current && scrubStartDataRef.current) {
          // If we were scrubbing, resume playback if it was playing before
          if (scrubStartDataRef.current.wasPlaying) togglePlay();
      } else if (e.button === 0) {
          // If it was just a click (no drag), toggle play/pause
          togglePlay();
      }
      
      isDragRef.current = false;
      setIsScrubbing(false);
      scrubStartDataRef.current = null;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };
  
  const toggleFullScreen = () => {
      if (!document.fullscreenElement) playerContainerRef.current?.requestFullscreen();
      else document.exitFullscreen();
  };
  
  const cycleFps = (e: React.MouseEvent) => {
      e.stopPropagation();
      const idx = VALID_FPS.indexOf(videoFps);
      setVideoFps(idx === -1 ? 24 : VALID_FPS[(idx + 1) % VALID_FPS.length]);
      setIsFpsDetected(false); // Manually overridden
  };

  // Dragging Controls Logic
  const handleDragStart = (e: React.PointerEvent) => {
      isDraggingControls.current = true;
      dragStartPos.current = { x: e.clientX - controlsPos.x, y: e.clientY - controlsPos.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handleDragMove = (e: React.PointerEvent) => {
      if (isDraggingControls.current) {
          setControlsPos({ x: e.clientX - dragStartPos.current.x, y: e.clientY - dragStartPos.current.y });
      }
  };
  const handleDragEnd = (e: React.PointerEvent) => {
      isDraggingControls.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const seek = (delta: number) => {
      if (videoRef.current) {
          const t = Math.min(Math.max(videoRef.current.currentTime + delta, 0), duration);
          videoRef.current.currentTime = t;
          setCurrentTime(t);
      }
  };

  // Comments Logic
  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const cId = generateId();
    syncCommentAction('create', { id: cId, text: newCommentText, timestamp: markerInPoint !== null ? markerInPoint : currentTime, duration: markerOutPoint && markerInPoint ? markerOutPoint - markerInPoint : undefined, status: CommentStatus.OPEN, authorName: currentUser.name });
    setNewCommentText(''); setMarkerInPoint(null); setMarkerOutPoint(null);
    setTimeout(() => { document.getElementById(`comment-${cId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100);
    sidebarInputRef.current?.blur();
    playerContainerRef.current?.focus();
  };
  
  const handleDeleteComment = (id: string) => { if (confirm(t('pv.delete_asset_confirm'))) syncCommentAction('delete', { id }); };
  const handleResolveComment = (e: React.MouseEvent, id: string) => { e.stopPropagation(); const c = comments.find(c => c.id === id); if (c) syncCommentAction('update', { id, status: c.status === CommentStatus.OPEN ? CommentStatus.RESOLVED : CommentStatus.OPEN }); };
  const startEditing = (comment: Comment) => { setEditingCommentId(comment.id); setEditText(comment.text); };
  const cancelEdit = () => { setEditingCommentId(null); setEditText(''); };
  const saveEdit = (id: string) => { syncCommentAction('update', { id, text: editText }); setEditingCommentId(null); setEditText(''); };
  const handleBulkResolve = () => { comments.filter(c => c.status === CommentStatus.OPEN).forEach(c => syncCommentAction('update', { id: c.id, status: CommentStatus.RESOLVED })); };

  // Add the missing function here
  const handleToggleLock = () => {
    const updatedVersions = [...asset.versions];
    const versionToUpdate = { ...updatedVersions[currentVersionIdx] };
    versionToUpdate.isLocked = !versionToUpdate.isLocked;
    updatedVersions[currentVersionIdx] = versionToUpdate;
    
    const updatedAssets = project.assets.map(a => a.id === asset.id ? { ...a, versions: updatedVersions } : a);
    onUpdateProject({ ...project, assets: updatedAssets });
    notify(versionToUpdate.isLocked ? t('player.lock_ver') : t('player.unlock_ver'), "info");
  };

  // Voice Logic
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) { notify("Speech recognition not supported in this browser.", "error"); return; }
    const SpeechRecognition = (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-US'; 
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onresult = (event: any) => { const t = event.results[0][0].transcript; setNewCommentText(prev => prev ? `${prev} ${t}` : t); };
    recognitionRef.current.start();
  };
  const toggleListening = () => { if (isListening) recognitionRef.current?.stop(); else startListening(); };
  const closeVoiceModal = (save: boolean) => { if (save) handleAddComment(); setShowVoiceModal(false); };

  // Markers
  const handleQuickMarker = () => { setMarkerInPoint(currentTime); setMarkerOutPoint(null); handleAddComment(); }; // Needs text? No, Quick Marker usually adds empty/default, but here we just set point.
  // Actually usually quick marker adds a marker instantly. Let's make it open comment box.
  const handleSetInPoint = () => { setMarkerInPoint(currentTime); notify("In Point Set", "info"); };
  const handleSetOutPoint = () => { if (markerInPoint !== null && currentTime > markerInPoint) { setMarkerOutPoint(currentTime); notify("Out Point Set", "info"); } else notify("Out point must be after In point", "error"); };
  const clearMarkers = () => { setMarkerInPoint(null); setMarkerOutPoint(null); };

  // Export
  const handleExport = (format: 'xml' | 'csv' | 'edl') => {
      let content = ''; let mime = 'text/plain'; let ext = '';
      if (format === 'xml') { content = generateResolveXML(project.name, version.versionNumber, comments); mime = 'application/xml'; ext = 'xml'; }
      else if (format === 'csv') { content = generateCSV(comments); mime = 'text/csv'; ext = 'csv'; }
      else { content = generateEDL(project.name, version.versionNumber, comments); mime = 'text/plain'; ext = 'edl'; }
      downloadFile(`${project.name}_v${version.versionNumber}.${ext}`, content, mime);
      setShowExportMenu(false);
  };

  const handleSelectCompareVersion = (idx: number | null) => {
      setCompareVersionIdx(idx);
      if (idx !== null) setViewMode('side-by-side');
      else setViewMode('single');
      setShowCompareMenu(false);
  };

  const handleSwitchVersion = (idx: number) => {
      // FORCE RESET STATES
      setDriveUrl(null); 
      setVideoError(false);
      setDriveFileMissing(false);
      setDriveUrlRetried(false);
      setLoadingDrive(true);
      
      setCurrentVersionIdx(idx);
      setShowVersionSelector(false);
      
      if (compareVersionIdx === idx) {
          setCompareVersionIdx(null);
          setViewMode('single');
      }
  };

  const filteredComments = comments.filter(c => c.text.toLowerCase().includes(searchQuery.toLowerCase()));
  const activeOverlayComments = comments.filter(c => {
      const s = c.timestamp; const e = c.duration ? (s + c.duration) : (s + 4);
      return currentTime >= s && currentTime <= e;
  });

  const getSourceBadge = () => {
      if (localFileName) {
          return (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20">
                  <HardDrive size={10} /> Local
              </div>
          );
      }
      if (version?.storageType === 'drive') {
          return (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                  <HardDrive size={10} /> Drive
              </div>
          );
      }
      return (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20">
              <Cloud size={10} /> Cloud
          </div>
      );
  };

  if (!version) return null; // Safety check

  return (
    <div className="flex flex-col h-[100dvh] bg-white dark:bg-zinc-950 overflow-hidden select-none fixed inset-0 transition-colors">
      <input type="file" accept=".mp4,.mov,.mkv,.webm,video/mp4,video/quicktime" style={{ display: 'none' }} ref={localFileRef} onChange={handleLocalFileSelect} onClick={(e) => (e.currentTarget.value = '')} />

      {!isFullscreen && (
        <header className="h-auto md:h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900 flex flex-row items-center justify-between px-2 md:px-4 shrink-0 z-50 relative backdrop-blur-md py-2 md:py-0 gap-2">
          {/* Header Content */}
          <div className="flex items-center gap-2 md:gap-3 overflow-hidden flex-1">
            <button onClick={onBack} className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors border border-zinc-200 dark:border-zinc-700 shrink-0" title={t('back')}><CornerUpLeft size={16} /></button>
            {(!isSearchOpen || window.innerWidth > 768) && (
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-zinc-900 dark:text-zinc-100 leading-tight truncate flex-1">
                   <div className="flex items-center gap-2">
                        {/* UNIFIED FILENAME & VERSION DROPDOWN */}
                       <div className="relative group/title">
                            <button 
                                onClick={() => setShowVersionSelector(!showVersionSelector)}
                                className="flex items-center gap-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 p-1.5 px-3 rounded-lg transition-colors text-left border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-xs md:text-sm truncate max-w-[200px] md:max-w-[400px]" title={localFileName || version.filename || asset.title}>
                                            {localFileName || version.filename || asset.title}
                                        </span>
                                        <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-md text-[10px] font-bold border border-indigo-100 dark:border-indigo-500/20">
                                            v{version.versionNumber} <ChevronDown size={10} />
                                        </div>
                                    </div>
                                </div>
                            </button>

                            {/* VERSION DROPDOWN CONTENT */}
                            {showVersionSelector && (
                                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 py-2 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                                    <div className="px-4 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800/50 mb-1">Select Version</div>
                                    {asset.versions.map((v, idx) => {
                                        const isCurrent = idx === currentVersionIdx;
                                        return (
                                            <button 
                                                key={v.id} 
                                                onClick={() => handleSwitchVersion(idx)} 
                                                className={`w-full text-left px-4 py-3 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/50 flex justify-between items-center transition-colors group/item ${isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}
                                            >
                                                <div className="flex flex-col gap-0.5 overflow-hidden">
                                                    <div className={`font-bold truncate ${isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                                        {v.filename || `Version ${v.versionNumber}`}
                                                    </div>
                                                    <div className="text-[10px] text-zinc-400">{v.uploadedAt}</div>
                                                </div>
                                                {isCurrent && <CheckCircle size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {showVersionSelector && <div className="fixed inset-0 z-40" onClick={() => setShowVersionSelector(false)}></div>}
                       </div>
                       
                       {getSourceBadge()}
                   </div>
                   
                   <div className="flex items-center gap-2">
                       {/* COMPARE SELECTOR */}
                       {asset.versions.length > 1 && (
                            <div className="relative">
                                <button onClick={() => setShowCompareMenu(!showCompareMenu)} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors border ${compareVersionIdx !== null ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-transparent hover:border-zinc-300 dark:hover:border-zinc-600'}`}>
                                    {compareVersionIdx !== null ? `vs v${compareVersion?.versionNumber}` : 'Compare'} <ChevronDown size={10} />
                                </button>
                                {showCompareMenu && (
                                    <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 py-2">
                                        <div className="px-4 py-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Compare With</div>
                                        <button onClick={() => handleSelectCompareVersion(null)} className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300">None (Single View)</button>
                                        <div className="h-px bg-zinc-100 dark:bg-zinc-800 my-1"></div>
                                        {asset.versions.map((v, idx) => (idx !== currentVersionIdx && (
                                            <button key={v.id} onClick={() => handleSelectCompareVersion(idx)} className={`w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 flex justify-between ${compareVersionIdx === idx ? 'text-indigo-600 font-bold' : 'text-zinc-600 dark:text-zinc-300'}`}>
                                                <span>Version {v.versionNumber}</span>{compareVersionIdx === idx && <CheckCircle size={12} />}
                                            </button>
                                        )))}
                                    </div>
                                )}
                                {showCompareMenu && <div className="fixed inset-0 z-40" onClick={() => setShowCompareMenu(false)}></div>}
                            </div>
                        )}
                       
                       {isSyncing ? <div className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500 animate-pulse text-[10px]" title={t('player.syncing')}><Cloud size={12} /></div> : <div className="flex items-center gap-1 text-green-500 dark:text-green-500/80 text-[10px]" title={t('player.saved')}><CheckCircle size={12} /></div>}
                       
                       {/* Link Source Button - Separate */}
                       <button onClick={(e) => { e.stopPropagation(); localFileRef.current?.click(); }} className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 transition-colors text-[10px] font-medium cursor-pointer" title={localFileName ? "Replace Local File" : "Link Local File to play without internet"}>
                           <Link size={10} />
                           <span className="hidden md:inline">{localFileName ? 'Replace Source' : 'Link File'}</span>
                       </button>
                   </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 md:gap-3 shrink-0">
             <div className={`flex items-center transition-all duration-300 ${isSearchOpen ? 'w-32 md:w-56 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2' : 'w-8 justify-end'}`}>
                {isSearchOpen && (<input autoFocus className="w-full bg-transparent text-xs text-zinc-900 dark:text-white outline-none py-1.5" placeholder={t('dash.search')} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onBlur={() => !searchQuery && setIsSearchOpen(false)} />)}
                <button onClick={() => { if (isSearchOpen && searchQuery) setSearchQuery(''); else setIsSearchOpen(!isSearchOpen); }} className={`p-1.5 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white ${isSearchOpen ? 'text-zinc-900 dark:text-white' : ''}`}>{isSearchOpen && searchQuery ? <XIcon size={16} /> : <Search size={18} />}</button>
             </div>
             <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden md:block"></div>
             <div className="relative">
                <button onClick={() => setShowMobileViewMenu(!showMobileViewMenu)} className="p-1.5 md:p-2 rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white">{viewMode === 'single' && <Monitor size={18} />}{viewMode === 'side-by-side' && <SplitSquareHorizontal size={18} />}</button>
                {showMobileViewMenu && (<div className="absolute top-full right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl p-1 flex flex-col gap-1 z-50 min-w-[120px]" onMouseLeave={() => setShowMobileViewMenu(false)}><button onClick={() => { setViewMode('single'); setShowMobileViewMenu(false); }} className={`flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${viewMode === 'single' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-600 dark:text-zinc-400'}`}><Monitor size={14} /> Single</button><button onClick={() => { setViewMode('side-by-side'); setShowMobileViewMenu(false); }} className={`flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${viewMode === 'side-by-side' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-600 dark:text-zinc-400'}`}><SplitSquareHorizontal size={14} /> Split (Compare)</button></div>)}
             </div>
          </div>
        </header>
      )}

      {/* The rest of the player component logic... */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
        {/* VIDEO CONTAINER */}
        <div ref={playerContainerRef} className={`flex-1 flex flex-col bg-black lg:border-r border-zinc-800 group/fullscreen overflow-hidden transition-all duration-300 outline-none ${isFullscreen ? 'fixed inset-0 z-[100] w-screen h-screen' : 'relative'}`} tabIndex={-1}>
          <div className="flex-1 relative w-full h-full flex items-center justify-center bg-zinc-950 overflow-hidden group/player">
             
             {/* ... Overlays ... */}
             <div className="absolute bottom-4 right-4 z-50 opacity-0 group-hover/player:opacity-100 transition-opacity duration-300">
                <button onClick={() => toggleFullScreen()} className="p-2 bg-black/60 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg backdrop-blur-sm transition-colors shadow-lg" title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>{isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
             </div>
             
             {/* Timecode & FPS */}
             <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-px bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 shadow-lg z-30 select-none overflow-hidden">
                <div className="px-3 py-1 text-white font-mono text-lg tracking-widest">{formatTimecode(currentTime)}</div>
                <div className="h-6 w-px bg-white/20"></div>
                <button onClick={cycleFps} className="px-2 py-1 hover:bg-white/10 transition-colors flex items-center gap-1.5 group/fps" title={t('player.fps')}><span className={`text-[10px] font-mono font-bold ${isFpsDetected ? 'text-indigo-400' : 'text-zinc-400 group-hover/fps:text-zinc-200'}`}>{Number.isInteger(videoFps) ? videoFps : videoFps.toFixed(2)} FPS</span></button>
             </div>

             {/* On-screen Comments */}
             <div className="absolute bottom-24 lg:bottom-12 left-4 z-20 flex flex-col items-start gap-2 pointer-events-none w-[80%] md:w-[60%] lg:w-[40%]">
                 {activeOverlayComments.map(c => { const a = {name: 'User', role: 'Viewer'}; const cl = stringToColor(c.userId); return (<div key={c.id} className="bg-black/60 text-white px-3 py-1.5 rounded-lg text-sm backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 border border-white/5 shadow-lg max-w-full break-words"><span style={{ color: cl }} className="font-bold mr-2 text-xs uppercase">{c.authorName || 'User'}:</span><span className="text-zinc-100">{c.text}</span></div>); })}
             </div>

             {/* Voice Modal */}
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

             {/* Play/Pause Center Icon */}
             {!isPlaying && !isScrubbing && !videoError && !showVoiceModal && !driveFileMissing && !loadingDrive && (<div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"><div className="w-16 h-16 bg-white/20 backdrop-blur rounded-full flex items-center justify-center shadow-xl animate-in fade-in zoom-in duration-200">{isPlaying ? <Pause size={32} fill="white" className="text-white"/> : <Play size={32} fill="white" className="ml-1 text-white" />}</div></div>)}

             {/* Loading State */}
             {loadingDrive && (<div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"><Loader2 size={48} className="animate-spin text-white/50"/></div>)}

             {/* Error State */}
             {videoError && !driveFileMissing && (<div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6 text-center animate-in fade-in duration-300"><div className="bg-zinc-800 p-4 rounded-full mb-4 ring-1 ring-zinc-700"><FileVideo size={32} className="text-zinc-400" /></div><p className="text-zinc-300 font-bold text-lg mb-2">{t('player.media_offline')}</p><p className="text-xs text-zinc-500 max-w-[280px] mb-6 leading-relaxed">{t('player.offline_desc')}</p><button onClick={(e) => { e.stopPropagation(); localFileRef.current?.click(); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm shadow-lg shadow-indigo-900/20 cursor-pointer"><Upload size={16} /> {t('player.link_local')}</button></div>)}

             {/* Drive File Missing State */}
             {driveFileMissing && (
                 <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-red-950/80 backdrop-blur-md p-6 text-center animate-in fade-in duration-300">
                     <div className="bg-red-900/50 p-4 rounded-full mb-4 ring-1 ring-red-700/50 text-red-300"><Trash2 size={32} /></div>
                     <h3 className="text-xl font-bold text-white mb-2">File Deleted from Drive</h3>
                     <p className="text-sm text-zinc-300 max-w-sm mb-6 leading-relaxed">
                         The source file for <strong>Version {version.versionNumber}</strong> was removed from Google Drive.
                     </p>
                     <div className="flex gap-3">
                         {isManager && (
                             <button onClick={handleRemoveDeadVersion} className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-lg transition-colors">
                                 Remove Version from App
                             </button>
                         )}
                         <button onClick={onBack} className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm border border-zinc-700 transition-colors">
                             Go Back
                         </button>
                     </div>
                 </div>
             )}

             {/* Video Element */}
             <div className={`relative w-full h-full flex items-center justify-center bg-black ${viewMode === 'side-by-side' ? 'grid grid-cols-2 gap-1' : ''}`}>
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    {viewMode === 'side-by-side' && <div className="absolute top-4 left-4 z-10 bg-black/60 text-white px-2 py-1 rounded text-xs font-bold pointer-events-none">v{version.versionNumber}</div>}
                    <video 
                        key={version.id} // Forces re-render when version changes
                        ref={videoRef} 
                        src={localFileSrc || driveUrl || version.url} 
                        className="w-full h-full object-contain pointer-events-none" 
                        onTimeUpdate={handleTimeUpdate} 
                        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setVideoError(false); setIsFpsDetected(false); setIsVerticalVideo(e.currentTarget.videoHeight > e.currentTarget.videoWidth); }} 
                        onError={handleVideoError} 
                        onEnded={() => setIsPlaying(false)} 
                        playsInline 
                        controls={false}
                        crossOrigin="anonymous" 
                    />
                </div>
                {viewMode === 'side-by-side' && compareVersion && (<div className="relative w-full h-full flex items-center justify-center overflow-hidden border-l border-zinc-800"><div className="absolute top-4 right-4 z-10 bg-black/60 text-indigo-400 px-2 py-1 rounded text-xs font-bold pointer-events-none">v{compareVersion.versionNumber}</div><video ref={compareVideoRef} src={compareVersion.url} className="w-full h-full object-contain pointer-events-none" muted playsInline controls={false} /></div>)}
                <div className="absolute inset-0 z-30 touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}></div>
             </div>
          </div>

          {/* Timeline & Controls */}
          <div className={`${isVerticalVideo ? 'absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black via-black/80 to-transparent pb-6 pt-10' : 'bg-zinc-900 border-t border-zinc-800 pb-2'} p-2 lg:p-4 shrink-0 transition-transform duration-300`}>
             <div className="relative h-6 md:h-8 group cursor-pointer flex items-center touch-none">
                <input type="range" min={0} max={duration || 100} step={0.01} value={currentTime} onChange={handleSeek} disabled={videoError || driveFileMissing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30 disabled:cursor-not-allowed" />
                <div className="w-full h-1.5 bg-zinc-700/50 rounded-full overflow-hidden relative"><div className="h-full bg-indigo-500" style={{ width: `${(currentTime / duration) * 100}%` }} /></div>
                {filteredComments.map(c => { const l = (c.timestamp / duration) * 100; const w = c.duration ? (c.duration / duration) * 100 : 0.5; const cl = stringToColor(c.userId); return (<div key={c.id} className={`absolute top-1/2 -translate-y-1/2 h-2.5 rounded-sm z-10 opacity-80 pointer-events-none`} style={{ left: `${l}%`, width: `${Math.max(0.5, w)}%`, minWidth: '4px', backgroundColor: c.status === 'resolved' ? '#22c55e' : cl }} />); })}
             </div>
          </div>
        </div>

        {/* SIDEBAR & CONTROLS (Floating) omitted for brevity as they are unchanged functionally, just re-rendered */}
        {!isFullscreen && (
        <div className="w-full lg:w-80 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col shrink-0 h-[45vh] lg:h-auto z-10 shadow-2xl lg:shadow-none pb-20 lg:pb-0 relative transition-colors">
             <>
                <div className="flex border-b border-zinc-200 dark:border-zinc-800">
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
                {/* ... Comments List Logic ... */}
                {sidebarTab === 'comments' && (
                    <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 sticky top-0 z-20">
                        <div className="flex items-center gap-3"><span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Total: ({filteredComments.length})</span></div>
                        <div className="flex items-center gap-2">
                            {isManager && (<><button onClick={handleToggleLock} className={`p-1 rounded transition-colors ${version.isLocked ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} title={version.isLocked ? t('player.unlock_ver') : t('player.lock_ver')}>{version.isLocked ? <Lock size={14} /> : <Unlock size={14} />}</button><div className="relative"><button onClick={() => setShowExportMenu(!showExportMenu)} className="p-1 text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors" title={t('player.export.title')}><Download size={14} /></button>{showExportMenu && (<div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100"><button onClick={() => handleExport('xml')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white text-left"><Film size={14} className="text-indigo-500 dark:text-indigo-400" />{t('player.export.xml')}</button><button onClick={() => handleExport('csv')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white text-left"><FileSpreadsheet size={14} className="text-green-500 dark:text-green-400" />{t('player.export.csv')}</button><button onClick={() => handleExport('edl')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white text-left"><FileText size={14} className="text-orange-500 dark:text-orange-400" />{t('player.export.edl')}</button></div>)}{showExportMenu && (<div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)}></div>)}</div></>)}
                            {isManager && filteredComments.some(c => c.status === CommentStatus.OPEN) && (<button onClick={handleBulkResolve} className="flex items-center gap-1 text-[9px] font-bold bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/50 hover:bg-green-200 dark:hover:bg-green-900/40 px-2 py-0.5 rounded transition-colors uppercase"><CheckSquare size={10} />{t('player.resolve_all')}</button>)}
                        </div>
                    </div>
                )}
                
                {/* Comments List & Transcript View implementation remains same as previous version */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 overflow-x-hidden bg-zinc-50 dark:bg-zinc-950 z-0">
                    {/* ... (Comments rendering logic) ... */}
                    {sidebarTab === 'comments' && filteredComments.map(comment => {
                        const isSelected = selectedCommentId === comment.id; const a = {name: comment.authorName || 'User', role: 'Viewer'}; const isCO = comment.userId === currentUser.id; const canR = isManager; const isE = editingCommentId === comment.id; const isG = false; const isS = swipeCommentId === comment.id; const o = isS ? swipeOffset : 0; const isA = currentTime >= comment.timestamp && currentTime < (comment.timestamp + (comment.duration || 3)); const cC = stringToColor(comment.userId); const canD = isManager || isCO; const canEd = isCO || (isManager && currentUser.role === UserRole.ADMIN);
                        return (
                        <div key={comment.id} className="relative group/wrapper" id={`comment-${comment.id}`}>
                            {/* ... same comment card ... */}
                             <div className="absolute inset-0 rounded-lg flex items-center justify-between px-4"><div className="flex items-center text-blue-500 gap-2 font-bold text-xs uppercase opacity-0 transition-opacity duration-200" style={{ opacity: o > 20 ? 1 : 0 }}><Pencil size={16} /> {t('common.edit')}</div><div className="flex items-center text-red-500 gap-2 font-bold text-xs uppercase opacity-0 transition-opacity duration-200" style={{ opacity: o < -20 ? 1 : 0 }}>{t('common.delete')} <Trash2 size={16} /></div></div>
                            <div onTouchStart={(e) => {}} style={{ transform: `translateX(${o}px)` }} onClick={() => { if (isE) return; setSelectedCommentId(comment.id); if (videoRef.current && !videoError) { videoRef.current.currentTime = comment.timestamp; setCurrentTime(comment.timestamp); setIsPlaying(false); videoRef.current.pause(); } }} className={`rounded-lg p-2 border text-xs cursor-pointer transition-all relative z-10 shadow-sm ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-500/50' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-zinc-700'} ${isG && !isSelected ? 'border-orange-200 dark:border-orange-500/20' : ''} ${isA && !isSelected ? 'border-l-4 border-l-indigo-500 bg-zinc-50 dark:bg-zinc-800 shadow-md ring-1 ring-inset ring-indigo-500/20' : ''}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2"><span className="font-bold text-zinc-900 dark:text-zinc-100" style={{ color: cC }}>{a.name.split(' ')[0]}</span>{isG && (<span className="text-[8px] uppercase font-bold text-orange-500 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 px-1 rounded bg-orange-50 dark:bg-transparent">Guest</span>)}<span className={`font-mono text-[10px] px-1 rounded flex items-center gap-1 ${isA ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-500/30' : 'text-zinc-400 dark:text-zinc-500'}`}>{formatTimecode(comment.timestamp)}{comment.duration && <span className="opacity-50">→ {formatTimecode(comment.timestamp + comment.duration)}</span>}</span></div>
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
                </div>

                {sidebarTab === 'comments' && (
                    <div className="fixed bottom-0 left-0 right-0 lg:static lg:w-full bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 z-50 p-2 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_-5px_15px_rgba(0,0,0,0.5)]">
                        {(markerInPoint !== null || markerOutPoint !== null) && (<div className="flex items-center gap-2 mb-2 px-1"><div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/20 uppercase"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div><span>Range: {formatTimecode(markerInPoint || currentTime)} - {markerOutPoint ? formatTimecode(markerOutPoint) : '...'}</span></div></div>)}
                        <div className="flex gap-2 items-center pb-[env(safe-area-inset-bottom)]">
                            <div className="relative flex-1">
                                <input ref={sidebarInputRef} disabled={isLocked} className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-3 pr-8 py-2 text-xs text-zinc-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all" placeholder={isLocked ? "Comments locked" : (isListening ? t('player.voice.listening') : t('player.voice.placeholder'))} value={newCommentText} onChange={e => setNewCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment()} onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300); }} />
                                <button onClick={toggleListening} disabled={isLocked} className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-white disabled:opacity-30'}`}>{isListening ? <MicOff size={12} /> : <Mic size={12} />}</button>
                            </div>
                            <button onClick={handleAddComment} disabled={!newCommentText.trim() || isLocked} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-2 rounded-lg transition-colors shrink-0 disabled:cursor-not-allowed shadow-sm"><Send size={14} /></button>
                        </div>
                    </div>
                )}
             </>
        </div>
        )}
      </div>

      <div className="fixed z-[9999] floating-controls touch-none" style={{ transform: `translate(${controlsPos.x}px, ${controlsPos.y}px)`, bottom: '40px', left: '50%', marginLeft: '-110px' }}>
        <div className={`flex items-center gap-1 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md rounded-xl p-1.5 border border-zinc-200 dark:border-zinc-800 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 transition-opacity ${isLocked ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            <div onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing border-r border-zinc-200 dark:border-zinc-800 mr-1 pointer-events-auto"><GripVertical size={14} /></div>
            <button onClick={handleQuickMarker} className="text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title={t('player.marker.quick')}><MapPin size={18} /></button>
            <button onClick={(e) => { e.stopPropagation(); seek(-10); }} className="text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors pointer-events-auto"><RotateCcw size={18} /></button>
            <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-0.5"></div>
            <button onClick={handleSetInPoint} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all border border-transparent ${markerInPoint !== null ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} title={t('player.marker.in')}>IN</button>
            <button onClick={handleSetOutPoint} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all border border-transparent ${markerOutPoint !== null ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} title={t('player.marker.out')}>OUT</button>
            <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-0.5"></div>
            <button onClick={(e) => { e.stopPropagation(); seek(10); }} className="text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors pointer-events-auto"><RotateCw size={18} /></button>
            {(markerInPoint !== null || markerOutPoint !== null) && (<button onClick={clearMarkers} className="ml-1 p-1.5 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"><XIcon size={14} /></button>)}
        </div>
      </div>
    </div>
  );
};
