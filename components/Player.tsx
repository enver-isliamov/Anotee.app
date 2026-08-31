import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Project, ProjectAsset, Comment, CommentStatus, User, AppConfig } from '../types';
import { ArrowLeftRight, Play, Pause, ChevronLeft, Send, CheckCircle, Search, Mic, MicOff, Trash2, Pencil, Save, X as XIcon, Layers, FileVideo, Upload, CheckSquare, Flag, Columns, Monitor, RotateCcw, RotateCw, Maximize, Minimize, MapPin, Gauge, GripVertical, Download, FileJson, FileSpreadsheet, FileText, MoreHorizontal, Film, AlertTriangle, Cloud, CloudOff, Loader2, HardDrive, Lock, Unlock, Clapperboard, ChevronRight, CornerUpLeft, SplitSquareHorizontal, ChevronDown, FileAudio, Sparkles, MessageSquare, List, Link, History, Bot, Wand2, Settings2, ShieldAlert, Server } from 'lucide-react';
import { generateEDL, generateCSV, generateResolveXML, downloadFile } from '../services/exportService';
import { generateId, stringToColor, formatTimecode } from '../services/utils';
import { ToastType } from './Toast';
import { useLanguage } from '../services/i18n';
import { extractAudioFromUrl } from '../services/audioUtils';
import { findDeletionComment, isWordDeleted, findDeletionsInRange, rangeDeletionText } from '../services/transcriptUtils';
import { loadTranscript, saveTranscript, clearTranscript } from '../services/transcriptStore';
import { GoogleDriveService } from '../services/googleDrive';
import { api } from '../services/apiClient';
import { useOrganization, useAuth } from '@clerk/clerk-react';
import { useSubscription } from '../hooks/useSubscription';
import { useAppConfig } from '../hooks/useAppConfig';
import { isFeatureEnabled } from '../services/entitlements';

// Кастомное зеркало Whisper-модели (РФ-устойчивость): Vite подставляет значение
// VITE_WHISPER_MODEL_BASE_URL на этапе сборки. Пусто/не задано → поле не передаётся
// в воркер и модель грузится с huggingface.co как раньше (docs/RF-RESILIENCE.md).
const WHISPER_MODEL_BASE_URL = (import.meta.env.VITE_WHISPER_MODEL_BASE_URL || '').trim();

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
  setIsPlayerActive?: (active: boolean) => void; // Smart Polling Control
}

const VALID_FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120];

// T-07: язык распознавания речи = язык интерфейса (i18n-код → BCP-47)
const SPEECH_RECOGNITION_LANGS: Record<string, string> = {
    en: 'en-US',
    ru: 'ru-RU',
    es: 'es-ES',
    pt: 'pt-BR',
    ja: 'ja-JP',
    ko: 'ko-KR',
};

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

// T-18: чувствительность скраба по видео утверждена владельцем (docs/SETTINGS.md,
// «Логика Скраббинга»): 5 пикселей = 1 кадр — точность таймкода до кадра при перемотке пальцем.
const VIDEO_SCRUB_PX_PER_FRAME = 5;

// T-18: безопасный pointer capture — на iOS системный жест может снять capture в любой
// момент: releasePointerCapture без hasPointerCapture-проверки бросает DOMException,
// setPointerCapture на уже неактивном pointer — NotFoundError
const setPointerCaptureSafe = (el: HTMLElement | null, pointerId: number) => {
    if (!el) return;
    try { el.setPointerCapture(pointerId); } catch { /* pointer уже неактивен */ }
};
const releasePointerCaptureSafe = (el: HTMLElement | null, pointerId: number) => {
    if (!el) return;
    try { if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId); } catch { /* capture уже снят */ }
};

// --- OPTIMIZATION: Memoized Sidebar Component with Mobile Gestures ---
const PlayerSidebar = React.memo(({ 
    sidebarTab, setSidebarTab, filteredComments, isManager, version, 
    handleToggleLock, setShowExportMenu, showExportMenu, handleExport, handleBulkResolve,
    currentUser, currentTime, editingCommentId, selectedCommentId, 
    setSelectedCommentId, videoRef, setVideoError, setPreviousTime, setIsPlaying,
    startEditing, handleDeleteComment, handleResolveComment, editText, setEditText, cancelEdit, saveEdit,
    phraseMode, setPhraseMode, phraseStartIdx, setPhraseStartIdx, onWordClick, comments: allComments,
    transcript, isTranscribing, transcribeProgress, transcribeLanguage, setTranscribeLanguage,
    transcribeModel, setTranscribeModel, handleTranscribe, loadingDrive, driveFileMissing, videoError,
    setTranscript, seekByFrame, videoFps, t
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
                            {isManager && (<><button onClick={handleToggleLock} className={`p-1 rounded transition-colors ${version.isLocked ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} title={version.isLocked ? t('player.unlock_ver') : t('player.lock_ver')}>{version.isLocked ? <Lock size={14} /> : <Unlock size={14} />}</button><div className="relative"><button id="tour-export-btn" onClick={() => setShowExportMenu(!showExportMenu)} className="p-1 text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors" title={t('player.export.title')}><Download size={14} /></button>{showExportMenu && (<div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100"><button onClick={() => handleExport('xml')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white text-left"><Film size={14} className="text-indigo-500 dark:text-indigo-400" />{t('player.export.xml')}</button><button onClick={() => handleExport('csv')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white text-left"><FileSpreadsheet size={14} className="text-green-500 dark:text-green-400" />{t('player.export.csv')}</button><button onClick={() => handleExport('edl')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white text-left"><FileText size={14} className="text-orange-500 dark:text-orange-400" />{t('player.export.edl')}</button></div>)}{showExportMenu && (<div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)}></div>)}</div></>)}
                            {isManager && filteredComments.some((c: any) => c.status === CommentStatus.OPEN) && (<button onClick={handleBulkResolve} className="flex items-center gap-1 text-[9px] font-bold bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-900/50 hover:bg-green-200 dark:hover:bg-green-900/40 px-2 py-0.5 rounded transition-colors uppercase"><CheckSquare size={10} />{t('player.resolve_all')}</button>)}
                        </div>
                    </div>
                )}
                
                <div className="flex-1 overflow-y-auto p-3 space-y-2 overflow-x-hidden bg-zinc-50 dark:bg-zinc-900 z-0 relative">
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
                                    <div className="flex items-center gap-2"><span className="font-bold text-zinc-900 dark:text-zinc-100" style={{ color: cC }}>{a.name.split(' ')[0]}</span><span className={`font-mono text-[10px] px-1 rounded flex items-center gap-1 ${isA ? 'text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-500/30' : 'text-zinc-400 dark:text-zinc-500'}`}>{formatTimecode(comment.timestamp, videoFps)}{comment.duration && <span className="opacity-50">→ {formatTimecode(comment.timestamp + comment.duration, videoFps)}</span>}</span></div>
                                    <div className="flex items-center gap-1">
                                        {canEd && !isE && (<button onClick={(e) => { e.stopPropagation(); startEditing(comment); }} className="text-zinc-400 hover:text-blue-500 opacity-0 group-hover/wrapper:opacity-100 transition-opacity p-1" title={t('common.edit')}><Pencil size={12} /></button>)}
                                        {canD && !isE && (<button onClick={(e) => { e.stopPropagation(); handleDeleteComment(comment.id); }} className="text-zinc-400 hover:text-red-500 opacity-0 group-hover/wrapper:opacity-100 transition-opacity p-1" title={t('common.delete')}><Trash2 size={12} /></button>)}
                                        {canR && !isE && (<button onClick={(e) => handleResolveComment(e, comment.id)} className={`p-1 ${comment.status==='resolved'?'text-green-500':'text-zinc-300 hover:text-green-500'}`}><CheckCircle size={12} /></button>)}
                                        {!canR && !isE && (<div className={`w-1.5 h-1.5 rounded-full mx-1 ${comment.status==='resolved'?'bg-green-500':'bg-yellow-500'}`} />)}
                                    </div>
                                </div>
                                {isE ? (<div className="mt-2" onClick={e => e.stopPropagation()}><textarea className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded p-2 text-xs text-zinc-900 dark:text-white focus:border-indigo-500 outline-none mb-2" value={editText} onChange={e => setEditText(e.target.value)} rows={3} autoFocus /><div className="flex justify-end gap-2"><button onClick={cancelEdit} className="px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">{t('cancel')}</button><button onClick={() => saveEdit(comment.id)} className="px-3 py-1 bg-indigo-600 text-white rounded text-[10px] flex items-center gap-1"><Save size={10} /> {t('save')}</button></div></div>) : (<p className={`text-zinc-700 dark:text-zinc-300 mb-0.5 whitespace-pre-wrap text-[13px] leading-relaxed ${comment.status === CommentStatus.RESOLVED ? 'line-through opacity-50' : ''}${(comment as any).editKind === 'delete' ? ' line-through text-red-500 dark:text-red-400' : ''}`}>{(comment as any).editKind === 'delete' && (<span className="inline-block mr-1 px-1 rounded bg-red-500/10 text-red-500 text-[9px] font-bold uppercase align-middle">{t('player.transcript.delete')}</span>)}{comment.text}</p>)}
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
                            {transcript && transcript.length > 0 && (
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    <div className="px-2 py-1 text-[10px] text-zinc-500 uppercase font-bold border-b border-zinc-200 dark:border-zinc-800/50 mb-2 flex justify-between items-center gap-2">
                                        <span>Result</span>
                                        <span className="flex items-center gap-2">
                                            <button onClick={() => { setPhraseMode(!phraseMode); setPhraseStartIdx(null); }} className={`px-2 py-0.5 rounded transition-colors normal-case ${phraseMode ? 'bg-indigo-600 text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>{t('player.transcript.phrase_mode')}</button>
                                            <button onClick={() => { setTranscript(null); if (version) clearTranscript(version.id); }} className="hover:text-red-500 transition-colors normal-case">Clear</button>
                                        </span>
                                    </div>
                                    {phraseMode && (<div className="px-2 pb-1 text-[10px] text-indigo-500">{phraseStartIdx === null ? t('player.transcript.phrase_hint') : t('player.transcript.phrase_end')}</div>)}
                                    <div className="px-2 py-1 text-[13px] leading-relaxed">
                                        {transcript.map((chunk: TranscriptChunk, i: number) => {
                                            const deleted = isWordDeleted(allComments, chunk);
                                            const isActive = !!(chunk.timestamp && currentTime >= chunk.timestamp[0] && currentTime < chunk.timestamp[1]);
                                            const isPhraseStart = phraseMode && phraseStartIdx === i;
                                            return (
                                                <span key={i} data-testid="transcript-word" onClick={() => onWordClick(chunk, i)} title={chunk.timestamp ? formatTimecode(chunk.timestamp[0], videoFps) : undefined} className={`inline-block mr-1 mb-0.5 px-1 rounded cursor-pointer transition-colors ${deleted ? 'line-through text-red-500 dark:text-red-400 bg-red-500/5 opacity-70' : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'} ${isActive && !deleted ? 'bg-indigo-50 dark:bg-indigo-900/20 text-zinc-900 dark:text-white font-medium ring-1 ring-indigo-400' : ''} ${isPhraseStart ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : ''}`}>{chunk.text.trim()}{' '}</span>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </>
        </div>
    );
});

// --- OPTIMIZATION: Floating Controls Component ---
const FloatingControls = React.memo(({ 
    initialPos, onPositionChange, isLocked, t, 
    handleQuickMarker, seek, handleSetInPoint, handleSetOutPoint, 
    markerInPoint, markerOutPoint, clearMarkers,
    openVoiceModal, isListening, toggleListening, isPTTActive, pttText, onMicPointerDown, onMicPointerUp // T-19: push-to-talk (зажать-говорить-отпустить)
}: any) => {
    // Clamp initial position to be safe
    const getSafePos = (p: {x: number, y: number}) => {
        const padding = 16;
        const width = 300; // Approx width
        const height = 60; // Approx height
        const maxX = window.innerWidth - width - padding;
        const maxY = window.innerHeight - height - padding;
        return {
            x: Math.min(Math.max(padding, p.x), maxX), // Clamp X (left to right)
            y: Math.min(Math.max(padding, p.y), maxY)  // Clamp Y (top to bottom)
        };
    };

    const [pos, setPos] = useState(() => getSafePos(initialPos));
    const dragRef = useRef<{ isDragging: boolean, startX: number, startY: number, initialX: number, initialY: number }>({ isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });
    const controlsRef = useRef<HTMLDivElement>(null);

    // Re-clamp on resize
    useEffect(() => {
        const handleResize = () => {
             setPos(prev => {
                 const safe = getSafePos(prev);
                 if (safe.x !== prev.x || safe.y !== prev.y) return safe;
                 return prev;
             });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const onPointerDown = (e: React.PointerEvent) => {
        e.preventDefault();
        dragRef.current = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            initialX: pos.x,
            initialY: pos.y
        };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragRef.current.isDragging) return;
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        
        let newX = dragRef.current.initialX + dx;
        let newY = dragRef.current.initialY + dy;

        // Clamp to screen bounds
        const el = controlsRef.current;
        if (el) {
            const rect = el.getBoundingClientRect();
            const maxX = window.innerWidth - rect.width - 16; // 16px padding
            const maxY = window.innerHeight - rect.height - 16;
            newX = Math.min(Math.max(16, newX), maxX);
            newY = Math.min(Math.max(16, newY), maxY);
        }

        // Update local state for smooth animation without re-rendering parent
        setPos({ x: newX, y: newY });
    };

    const onPointerUp = (e: React.PointerEvent) => {
        if (dragRef.current.isDragging) {
            dragRef.current.isDragging = false;
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            onPositionChange(pos); // Persist position
        }
    };

    return (
        <div ref={controlsRef} className="fixed z-[9999] floating-controls touch-none transition-transform duration-75 ease-out will-change-transform" style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, bottom: 'auto', right: 'auto', left: '0', top: '0' }}>
            <div className={`flex flex-row items-center gap-2 md:gap-1 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md rounded-xl p-2 md:p-1.5 border border-zinc-200 dark:border-zinc-800 shadow-2xl ring-1 ring-black/5 dark:ring-white/5 transition-opacity ${isLocked ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:text-zinc-600 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing border-r border-zinc-200 dark:border-zinc-800 mr-1 pointer-events-auto"><GripVertical size={14} /></div>
                
                <div className="flex items-center gap-1">
                    <button onClick={handleQuickMarker} className="w-10 h-10 md:w-auto md:h-auto flex items-center justify-center text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors" title={t('player.marker.quick')}><MapPin size={20} /></button>
                    <button onClick={(e) => { e.stopPropagation(); seek(-5); }} className="w-10 h-10 md:w-auto md:h-auto flex items-center justify-center text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors pointer-events-auto"><RotateCcw size={20} /></button>
                    <div className="hidden md:block w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-0.5"></div>
                    <button onClick={(e) => { e.stopPropagation(); seek(5); }} className="w-10 h-10 md:w-auto md:h-auto flex items-center justify-center text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors pointer-events-auto"><RotateCw size={20} /></button>
                </div>

                <div className="flex items-center gap-1 w-auto justify-center">
                    <button onClick={handleSetInPoint} className={`flex-none text-xs font-bold px-3 py-2 md:py-1.5 rounded-lg transition-all border border-transparent ${markerInPoint !== null ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-zinc-100 dark:bg-zinc-800 md:bg-transparent'}`} title={t('player.marker.in')}>IN</button>
                    <button onClick={handleSetOutPoint} className={`flex-none text-xs font-bold px-3 py-2 md:py-1.5 rounded-lg transition-all border border-transparent ${markerOutPoint !== null ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 bg-zinc-100 dark:bg-zinc-800 md:bg-transparent'}`} title={t('player.marker.out')}>OUT</button>
                    {/* T-19: push-to-talk — зажми и говори; короткий тап открывает VoiceModal */}
                    <button
                        onPointerDown={(e) => { e.preventDefault(); onMicPointerDown(); }}
                        onPointerUp={(e) => { e.preventDefault(); onMicPointerUp(); }}
                        onPointerCancel={() => { onMicPointerUp(); }}
                        onLostPointerCapture={() => { onMicPointerUp(); }}
                        onContextMenu={(e) => e.preventDefault()}
                        className={`ml-1 w-10 h-10 md:w-auto md:h-auto flex items-center justify-center p-2 md:p-1.5 rounded-lg transition-colors touch-none select-none ${isPTTActive ? 'bg-red-500 text-white animate-pulse' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-white'}`}
                        title={t('player.voice.ptt_hint')}
                    ><Mic size={16} /></button>
                    {isPTTActive && (
                        <div data-testid="ptt-pill" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max max-w-[260px] bg-black/75 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2 shadow-xl pointer-events-none z-[10000]">
                            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0"></span><span className="text-[10px] font-bold uppercase tracking-wider text-red-300 shrink-0">REC</span></div>
                            <div className="text-xs text-white mt-1 break-words line-clamp-2 min-h-[16px]">{pttText || '…'}</div>
                        </div>
                    )}
                    {(markerInPoint !== null || markerOutPoint !== null) && (
                        <button onClick={clearMarkers} className="ml-1 p-2 md:p-1.5 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"><XIcon size={16} /></button>
                    )}
                </div>
            </div>
        </div>
    );
});

// ... (Rest of file unchanged, just export Player) ...
export const Player: React.FC<PlayerProps> = ({ asset, project, currentUser, onBack, users, onUpdateProject, isSyncing, notify, isDemo = false, isMockMode = false, setIsPlayerActive }) => {
  const { t, language } = useLanguage();
  
  // Smart Polling: Activate on Mount, Deactivate on Unmount
  useEffect(() => {
      if (setIsPlayerActive) setIsPlayerActive(true);
      return () => { if (setIsPlayerActive) setIsPlayerActive(false); };
  }, []);

  // Activity Tracker for Smart Polling
  useEffect(() => {
      if (!setIsPlayerActive) return;
      
      let idleTimer: NodeJS.Timeout;
      
      const goActive = () => {
          setIsPlayerActive(true);
          clearTimeout(idleTimer);
          idleTimer = setTimeout(() => setIsPlayerActive(false), 60000); // Go idle after 60s of no interaction
      };

      const events = ['mousemove', 'keydown', 'click', 'touchstart'];
      events.forEach(e => window.addEventListener(e, goActive));
      
      // Initial activation
      goActive();

      return () => {
          events.forEach(e => window.removeEventListener(e, goActive));
          clearTimeout(idleTimer);
      };
  }, []);
  const { organization } = useOrganization();
  const { plan } = useSubscription(); // Use generic plan
  const { config } = useAppConfig();
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
  // T-18: ref-объект вместо boolean — храним pointerId, чтобы второй палец не перезаписывал скраб
  const isDragRef = useRef<{ active: boolean, pointerId: number | null }>({ active: false, pointerId: null });

  const [isVideoScrubbing, setIsVideoScrubbing] = useState(false);
  // T-18: pointerId — игнор чужих пальцев (мультитач)
  const videoScrubRef = useRef<{ startX: number, startTime: number, isDragging: boolean, isPressed: boolean, pointerId: number | null }>({ startX: 0, startTime: 0, isDragging: false, isPressed: false, pointerId: null });
  // T-23: диагностика ошибки S3 + перезагрузка версии (retry)
  const [s3ErrorDetail, setS3ErrorDetail] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

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
  // T-07: состояние диктовки — финальные результаты накапливаем, interim подставляем временно.
  // Всё считается в refs ВНЕ setState-updater (updater обязан быть чистым: React вызывает его повторно),
  // ручной ввод отслеживаем в onChange (программная установка value onChange не вызывает).
  const manualBaseRef = useRef('');       // база: текст пользователя на момент старта/ручных правок
  const finalTranscriptRef = useRef('');  // накопленные финальные результаты
  const pendingInterimRef = useRef('');   // текущий незавершённый interim
  const lastDictatedRef = useRef<string | null>(null); // последняя строка, выставленная диктовкой

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
  
  useEffect(() => {
    localStorage.setItem('anotee_controls_pos', JSON.stringify(controlsPos));
  }, [controlsPos]);

  useEffect(() => {
      return () => {
          if (workerRef.current) {
              workerRef.current.terminate();
              workerRef.current = null;
          }
          // T-07: при размонтировании останавливаем распознавание (onend-безопасно)
          if (recognitionRef.current) {
              try {
                  recognitionRef.current.onend = null;
                  recognitionRef.current.stop();
              } catch { /* уже остановлено */ }
              recognitionRef.current = null;
          }
      };
  }, []);

  // T-08: window.innerWidth в рендере запрещён (AGENTS.md §5) — только state + resize-листенер
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => window.innerWidth > 768);
  useEffect(() => {
      const handleViewportResize = () => setIsDesktopViewport(window.innerWidth > 768);
      window.addEventListener('resize', handleViewportResize);
      return () => window.removeEventListener('resize', handleViewportResize);
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
                    if (result && Array.isArray(result.chunks)) { setTranscript(result.chunks); saveTranscript(version?.id || "", result.chunks); notify("Transcription complete", "success"); }
                    setIsTranscribing(false); setTranscribeProgress(null);
                } else if (type === 'error') { console.error("Worker Error:", error); notify(`Transcription Failed: ${error}`, "error"); setIsTranscribing(false); setTranscribeProgress(null); }
             };
        }
        notify("Extracting audio...", "info");
        const isProxy = sourceUrl.includes('drive.google.com') && !localFileSrc;
        const audioData = await extractAudioFromUrl(sourceUrl, isProxy);
        notify(`Starting AI Model...`, "info");
        workerRef.current.postMessage({
          type: 'transcribe',
          audio: audioData, wordTimestamps: true,
          language: transcribeLanguage,
          model: transcribeModel,
          // Не передаём modelBaseUrl, если зеркало не настроено — воркер ведёт себя как раньше
          ...(WHISPER_MODEL_BASE_URL ? { modelBaseUrl: WHISPER_MODEL_BASE_URL } : {}),
        });
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

  // T-18: getToken из useAuth() — нестабильная ссылка (в mock-шиме clerkShim.ts создаёт новую
  // на каждый рендер): в deps эффекта версии она перезапускала эффект на каждом рендере →
  // `currentTime = 0; load()` отматывал видео назад во время скраба/плейбека. Токен читаем через ref.
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; }, [getToken]);

  // DRIVE & S3 LOADING (UPDATED)
  useEffect(() => {
    setIsPlaying(false); setCurrentTime(0); setSelectedCommentId(null); setEditingCommentId(null); setMarkerInPoint(null); setMarkerOutPoint(null);
    setVideoError(false); setDriveFileMissing(false); setDrivePermissionError(false); setDriveUrlRetried(false); setDriveUrl(null); setLoadingDrive(false);
    setShowVoiceModal(false); setIsFpsDetected(false); setIsVerticalVideo(false); setTranscript(loadTranscript(version?.id || "") || null); cancelPTT(); setS3ErrorDetail(null);

    const checkRemoteStatus = async () => {
        if (!isMockMode) {
            // S3 PATH
            if (version?.storageType === 's3' && version.s3Key) {
                setLoadingDrive(true);
                try {
                    const token = await getTokenRef.current();
                    // Get Presigned GET URL
                    // UPDATED API PATH
                    const presignRes = await fetch('/api/storage?action=presign', {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            operation: 'get',
                            key: version.s3Key,
                            projectId: project.id // CRITICAL: Pass projectId for access check
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
                        const err = await presignRes.json();
                        console.error("S3 Sign Failed", err);
                        throw Object.assign(new Error(err.error || "Failed to sign S3 URL"), { status: presignRes.status });
                    }
                } catch (e) {
                    console.error("S3 Load Error", e);
                    const st = (e as any)?.status; setS3ErrorDetail(st === 401 ? 'auth' : (st === 403 || st === 404) ? 'config' : 'network');
                    setVideoError(true);
                } finally {
                    setLoadingDrive(false);
                }
            } 
            // LOCAL OPTIMISTIC PATH
            else if (version?.storageType === 'local' && version.localFileUrl) {
                setLocalFileSrc(version.localFileUrl);
                setLocalFileName(version.localFileName || 'Uploading...');
                setLoadingDrive(false);
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
  }, [version?.id, isMockMode, isOwner]);

  // ... (Rest of Player Handlers, Render logic unchanged) ...
  // Player Handlers
  useEffect(() => { 
      const handleFsChange = () => { 
          const doc = document as any;
          const isFs = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
          setIsFullscreen(isFs); 
          if (!isFs) setShowVoiceModal(false); 
      }; 
      
      document.addEventListener('fullscreenchange', handleFsChange);
      document.addEventListener('webkitfullscreenchange', handleFsChange);
      document.addEventListener('mozfullscreenchange', handleFsChange);
      document.addEventListener('msfullscreenchange', handleFsChange);
      
      return () => {
          document.removeEventListener('fullscreenchange', handleFsChange);
          document.removeEventListener('webkitfullscreenchange', handleFsChange);
          document.removeEventListener('mozfullscreenchange', handleFsChange);
          document.removeEventListener('msfullscreenchange', handleFsChange);
      };
  }, []);
  
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
  // T-18: pointerId-guard на всех стадиях — Move/Up/Cancel чужого пальца не завершают скраб
  const handleTimelinePointerDown = (e: React.PointerEvent) => {
      if (isDragRef.current.active) return; // мультитач: второй палец не перехватывает скраб
      isDragRef.current = { active: true, pointerId: e.pointerId };
      setIsScrubbing(true);
      if (isPlaying) { setIsPlaying(false); videoRef.current?.pause(); }
      updateScrubPosition(e);
      setPointerCaptureSafe(e.target as HTMLElement, e.pointerId);
  };
  const handleTimelinePointerMove = (e: React.PointerEvent) => { if (isDragRef.current.active && isDragRef.current.pointerId === e.pointerId) { updateScrubPosition(e); } };
  const updateScrubPosition = (e: React.PointerEvent) => { if (!timelineRef.current || !videoRef.current) return; const rect = timelineRef.current.getBoundingClientRect(); const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width)); const percentage = x / rect.width; const newTime = percentage * duration; setCurrentTime(newTime); videoRef.current.currentTime = newTime; if (compareVideoRef.current) compareVideoRef.current.currentTime = newTime; };
  // T-18: единый safeEnd для pointerup/pointercancel/lostpointercapture (iOS-системный жест
  // обрывает pointer-сессию — без cancel-обработчиков плеер зависал в режиме скраба)
  const handleTimelinePointerUp = (e: React.PointerEvent) => {
      if (!isDragRef.current.active || isDragRef.current.pointerId !== e.pointerId) return;
      isDragRef.current = { active: false, pointerId: null };
      setIsScrubbing(false);
      releasePointerCaptureSafe(e.target as HTMLElement, e.pointerId);
  };

  // T-18: мультитач — пока первый палец скрабит, pointerdown второго игнорируем;
  // ширина оверлея кэшируется на pointerdown (getBoundingClientRect на каждый move — layout thrashing)
  const handleVideoDragStart = (e: React.PointerEvent) => {
      if (videoScrubRef.current.isPressed) return;
      e.preventDefault();
      videoScrubRef.current = { startX: e.clientX, startTime: currentTime, isDragging: false, isPressed: true, pointerId: e.pointerId };
      setPointerCaptureSafe(e.currentTarget as HTMLElement, e.pointerId);
  };
  const handleVideoDragMove = (e: React.PointerEvent) => {
      const scrub = videoScrubRef.current;
      if (!scrub.isPressed || scrub.pointerId !== e.pointerId) return; // чужой палец игнорируем
      if (!scrub.isDragging) {
          if (Math.abs(e.clientX - scrub.startX) > 10) {
              scrub.isDragging = true;
              setIsVideoScrubbing(true);
              if (isPlaying) togglePlay();
          } else {
              return;
          }
      }
      // T-18: кадровая точность утверждена владельцем (SETTINGS.md): 5px = 1 кадр.
      // duration=0/Infinity/NaN → скраб не двигаем.
      const scrubDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
      if (scrubDuration <= 0) return;
      const framesMoved = Math.round((e.clientX - scrub.startX) / VIDEO_SCRUB_PX_PER_FRAME);
      const newTime = Math.max(0, Math.min(scrubDuration, scrub.startTime + framesMoved / videoFps));
      setCurrentTime(newTime);
      if (videoRef.current) videoRef.current.currentTime = newTime;
      if (compareVideoRef.current) compareVideoRef.current.currentTime = newTime;
  };
  // T-18: safeEnd — тот же обработчик для pointerup, pointercancel и lostpointercapture
  // (повторный вызов идемпотентен; release только при hasPointerCapture — без проверки
  // повторный end после cancel бросал DOMException)
  const handleVideoDragEnd = (e: React.PointerEvent) => {
      const scrub = videoScrubRef.current;
      if (scrub.pointerId !== null && scrub.pointerId !== e.pointerId) return; // чужой палец игнорируем
      if (scrub.isPressed && !scrub.isDragging) togglePlay();
      setIsVideoScrubbing(false);
      scrub.isDragging = false;
      scrub.isPressed = false;
      scrub.pointerId = null;
      releasePointerCaptureSafe(e.currentTarget as HTMLElement, e.pointerId);
  };

  const toggleFullScreen = () => { 
      const container = playerContainerRef.current as any;
      const doc = document as any;

      // Use state to decide action, ensuring we can exit CSS fallback mode
      if (isFullscreen) {
          // 2. Exit Fullscreen
          if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
          else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
          else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
          else if (doc.msExitFullscreen) doc.msExitFullscreen();
          
          // Always reset state (handles CSS fallback case)
          setIsFullscreen(false);
      } else {
          // 1. Enter Fullscreen
          // Standard API
          if (container.requestFullscreen) {
              container.requestFullscreen().catch(() => {
                  // Fallback if API fails
                  setIsFullscreen(true);
              });
          }
          // Safari / iOS / Old Chrome
          else if (container.webkitRequestFullscreen) {
              container.webkitRequestFullscreen();
          } 
          // iOS Fallback (Force CSS Fullscreen)
          else {
              setIsFullscreen(true);
          }
      }
  };

  const cycleFps = (e: React.MouseEvent) => { e.stopPropagation(); const idx = VALID_FPS.indexOf(videoFps); setVideoFps(idx === -1 ? 24 : VALID_FPS[(idx + 1) % VALID_FPS.length]); setIsFpsDetected(false); };
  // Drag handlers moved to FloatingControls component
  const seek = (delta: number) => { if (videoRef.current) { const t = Math.min(Math.max(videoRef.current.currentTime + delta, 0), duration); videoRef.current.currentTime = t; setCurrentTime(t); } };
  // T-19: создание комментария вынесено (text параметром) — push-to-talk коммитит без чтения свежего state (stale closure)
  const createComment = (text: string, timestampOverride?: number) => { const cId = generateId(); syncCommentAction('create', { id: cId, text, timestamp: markerInPoint !== null ? markerInPoint : (timestampOverride ?? currentTime), duration: markerOutPoint && markerInPoint ? markerOutPoint - markerInPoint : undefined, status: CommentStatus.OPEN, authorName: currentUser.name }); setNewCommentText(''); setMarkerInPoint(null); setMarkerOutPoint(null); setTimeout(() => { document.getElementById(`comment-${cId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 100); sidebarInputRef.current?.blur(); playerContainerRef.current?.focus(); };
  const handleAddComment = () => { createComment(newCommentText); };
  const handleDeleteComment = (id: string) => { if (confirm(t('pv.delete_asset_confirm'))) syncCommentAction('delete', { id }); };
  const handleResolveComment = (e: React.MouseEvent, id: string) => { e.stopPropagation(); const c = comments.find(c => c.id === id); if (c) syncCommentAction('update', { id, status: c.status === CommentStatus.OPEN ? CommentStatus.RESOLVED : CommentStatus.OPEN }); };
  const startEditing = (comment: Comment) => { setEditingCommentId(comment.id); setEditText(comment.text); };
  const cancelEdit = () => { setEditingCommentId(null); setEditText(''); };
  const saveEdit = (id: string) => { syncCommentAction('update', { id, text: editText }); setEditingCommentId(null); setEditText(''); };
  const handleBulkResolve = () => { comments.filter(c => c.status === CommentStatus.OPEN).forEach(c => syncCommentAction('update', { id: c.id, status: CommentStatus.RESOLVED })); };
  const handleToggleLock = () => { const updatedVersions = [...asset.versions]; const versionToUpdate = { ...updatedVersions[currentVersionIdx] }; versionToUpdate.isLocked = !versionToUpdate.isLocked; updatedVersions[currentVersionIdx] = versionToUpdate; const updatedAssets = project.assets.map(a => a.id === asset.id ? { ...a, versions: updatedVersions } : a); onUpdateProject({ ...project, assets: updatedAssets }); notify(versionToUpdate.isLocked ? t('player.lock_ver') : t('player.unlock_ver'), "info"); };
  // T-07: ручной ввод в поле комментария во время слушания становится новой базой
  // (onChange не срабатывает при программной установке value → диктовка не «перепутается» с печатью)
  const handleCommentTextChange = (value: string) => {
      if (lastDictatedRef.current === null || value !== lastDictatedRef.current) {
          manualBaseRef.current = value;
      }
      setNewCommentText(value);
  };
  // T-07: выставляем текст диктовки: база + накопленные финалы + текущий interim
  const applyDictation = () => {
      const dictated = [finalTranscriptRef.current, pendingInterimRef.current].filter(Boolean).join(' ');
      const next = [manualBaseRef.current, dictated].filter(Boolean).join(' ');
      lastDictatedRef.current = next;
      setNewCommentText(next);
  };
  const startListening = () => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
          notify(t('player.voice.unsupported'), "error");
          return;
      }
      // Перезапуск: глушим предыдущую сессию, чтобы start() не бросил InvalidStateError
      if (recognitionRef.current) {
          try {
              recognitionRef.current.onend = null;
              recognitionRef.current.onresult = null;
              recognitionRef.current.stop();
          } catch { /* уже остановлено */ }
          recognitionRef.current = null;
      }
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = true;
      // T-07: язык распознавания = язык интерфейса
      recognition.lang = SPEECH_RECOGNITION_LANGS[language] || 'en-US';
      // База диктовки: текст, который был в поле до старта
      manualBaseRef.current = newCommentText;
      finalTranscriptRef.current = '';
      pendingInterimRef.current = '';
      lastDictatedRef.current = newCommentText;
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => {
          setIsListening(false);
          // continuous=false: сессия завершена — дозакрепляем незавершённый interim как финальный
          if (pendingInterimRef.current) {
              const tail = pendingInterimRef.current.trim();
              finalTranscriptRef.current = finalTranscriptRef.current ? `${finalTranscriptRef.current} ${tail}` : tail;
              pendingInterimRef.current = '';
              applyDictation();
          }
          if (recognitionRef.current === recognition) recognitionRef.current = null;
      };
      // T-07: понятный фидбек вместо молчаливого провала
      recognition.onerror = (event: any) => {
          const code = event?.error;
          if (code === 'not-allowed' || code === 'service-not-allowed') {
              notify(t('player.voice.err_denied'), "error");
          } else if (code === 'network') {
              notify(t('player.voice.err_network'), "error");
          } else if (code === 'no-speech') {
              // Пользователь просто промолчал — не ошибка
          } else {
              notify(`${t('player.voice.err_generic')}${code}`, "error");
          }
          setIsListening(false);
      };
      recognition.onresult = (event: any) => {
          let interim = '';
          const startIndex = typeof event.resultIndex === 'number' ? event.resultIndex : 0;
          for (let i = startIndex; i < event.results.length; i++) {
              const result = event.results[i];
              const transcript = result[0].transcript as string;
              if (result.isFinal) {
                  finalTranscriptRef.current = finalTranscriptRef.current ? `${finalTranscriptRef.current} ${transcript.trim()}` : transcript.trim();
              } else {
                  interim += transcript;
              }
          }
          pendingInterimRef.current = interim;
          applyDictation();
      };
      try { recognition.start(); } catch (e) { console.warn("SpeechRecognition start failed", e); setIsListening(false); }
  };
  const toggleListening = () => { if (isListening) recognitionRef.current?.stop(); else startListening(); };
  // T-07: открытие VoiceModal без клавиатуры (мобильные) — крупное поле + таймкод
  const openVoiceModal = () => { setShowVoiceModal(true); startListening(); };
  const closeVoiceModal = (save: boolean) => { if (save) handleAddComment(); setShowVoiceModal(false); };
  // T-20: пословное удаление из транскрипта (комментарии editKind=delete персистятся в проекте)
  const [showTxtOverlay, setShowTxtOverlay] = useState(false);
  const [phraseMode, setPhraseMode] = useState(false);
  const [phraseStartIdx, setPhraseStartIdx] = useState<number | null>(null);
  const onWordClick = (word: { text: string; timestamp: [number, number] | null }, idx: number) => {
      if (!word.timestamp) return;
      const arr = transcript ?? [];
      if (phraseMode) {
          if (phraseStartIdx === null) { setPhraseStartIdx(idx); return; }
          const from = Math.min(idx, phraseStartIdx); const to = Math.max(idx, phraseStartIdx);
          const s = arr[from]?.timestamp?.[0]; const e = arr[to]?.timestamp?.[1];
          if (s === undefined || e === undefined) { setPhraseStartIdx(null); return; }
          findDeletionsInRange(comments, s, e).forEach((c) => syncCommentAction('delete', { id: c.id }));
          const phraseText = rangeDeletionText(arr, from, to);
          if (phraseText) syncCommentAction('create', { id: generateId(), text: `${t('player.transcript.delete_phrase')}: «${phraseText}»`, timestamp: s, duration: Math.max(0.05, e - s), status: CommentStatus.OPEN, authorName: currentUser.name, editKind: 'delete' as const });
          setPhraseStartIdx(null);
          return;
      }
      const existing = findDeletionComment(comments, word);
      if (existing) { syncCommentAction('delete', { id: existing.id }); return; }
      const end = word.timestamp[1] ?? word.timestamp[0] + 0.5;
      syncCommentAction('create', { id: generateId(), text: `${t('player.transcript.delete')}: «${word.text.trim()}»`, timestamp: word.timestamp[0], duration: Math.max(0.05, end - word.timestamp[0]), status: CommentStatus.OPEN, authorName: currentUser.name, editKind: 'delete' as const });
  };
  // T-23: учёт экранной клавиатуры — поднимаем бар комментариев над ней (мобильные)
  const [kbLift, setKbLift] = useState(0);
  useEffect(() => {
      const vv = (window as any).visualViewport as VisualViewport | undefined;
      if (!vv) return;
      const update = () => {
          const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
          setKbLift(overlap > 120 ? Math.round(overlap) : 0);
      };
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      window.addEventListener('focusin', update);
      window.addEventListener('focusout', update);
      return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); window.removeEventListener('focusin', update); window.removeEventListener('focusout', update); };
  }, []);
  // T-19: push-to-talk — зажал mic в FloatingControls → говоришь (маленькая пилюля с живым текстом
  // над контролами, НЕ перекрывая видео) → отпустил → комментарий на текущем таймкоде.
  // Короткий тап (<400ms без диктовки) — прежний workflow: открыть VoiceModal.
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [pttText, setPttText] = useState("");
  const pttRecognitionRef = useRef<any>(null);
  const pttBaseRef = useRef("");
  const pttFinalRef = useRef("");
  const pttInterimRef = useRef("");
  const pttErrorRef = useRef(false);
  const pttCancelRef = useRef(false);
  const pttStartedAtRef = useRef(0);
  const isPTTActiveRef = useRef(false);
  const startPTT = () => {
      if (isPTTActiveRef.current) return;
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) { notify(t("player.voice.unsupported"), "error"); return; }
      // Глушим sidebar/VoiceModal-сессию, чтобы start() не бросил InvalidStateError
      if (recognitionRef.current) {
          try { recognitionRef.current.onend = null; recognitionRef.current.onresult = null; recognitionRef.current.stop(); } catch { /* уже остановлено */ }
          recognitionRef.current = null;
          setIsListening(false);
      }
      const recognition = new SpeechRecognition();
      pttRecognitionRef.current = recognition;
      pttBaseRef.current = newCommentText;
      pttFinalRef.current = "";
      pttErrorRef.current = false;
      pttCancelRef.current = false;
      pttStartedAtRef.current = Date.now();
      setPttText("");
      recognition.continuous = true;
      recognition.interimResults = true;
      // T-19: язык распознавания = язык интерфейса (ru/en/es/pt/ja/ko) — не только английский
      recognition.lang = SPEECH_RECOGNITION_LANGS[language] || "en-US";
      recognition.onstart = () => { isPTTActiveRef.current = true; setIsPTTActive(true); };
      recognition.onresult = (event: any) => {
          let interim = "";
          const startIndex = typeof event.resultIndex === "number" ? event.resultIndex : 0;
          for (let i = startIndex; i < event.results.length; i++) {
              const result = event.results[i];
              const transcript = result[0].transcript as string;
              if (result.isFinal) pttFinalRef.current = pttFinalRef.current ? `${pttFinalRef.current} ${transcript.trim()}` : transcript.trim();
              else interim += transcript;
          }
          pttInterimRef.current = interim;
          setPttText([pttFinalRef.current, interim].filter(Boolean).join(" "));
      };
      recognition.onerror = (event: any) => {
          const code = event?.error;
          if (code === "not-allowed" || code === "service-not-allowed") notify(t("player.voice.err_denied"), "error");
          else if (code === "network") notify(t("player.voice.err_network"), "error");
          else if (code === "no-speech") { /* промолчал — не ошибка */ }
          else { pttErrorRef.current = true; notify(`${t("player.voice.err_generic")}${code}`, "error"); }
      };
      recognition.onend = () => { finishPTTCommit(); };
      try { recognition.start(); } catch (e) { console.warn("PTT start failed", e); }
  };
  const finishPTTCommit = () => {
      if (!pttRecognitionRef.current) return; // идемпотентность: onend может прийти повторно
      pttRecognitionRef.current = null;
      isPTTActiveRef.current = false;
      setIsPTTActive(false);
      setPttText("");
      if (pttCancelRef.current) { pttCancelRef.current = false; return; } // тап-отмена: модалка уже открыта
      pttInterimRef.current = "";
      const dictated = [pttFinalRef.current.trim(), pttInterimRef.current.trim()].filter(Boolean).join(" ");
      const text = [pttBaseRef.current, dictated].filter(Boolean).join(" ").trim();
      if (!dictated) {
          if (!pttErrorRef.current) notify(t("player.voice.need_text"), "warning");
          pttErrorRef.current = false;
          return;
      }
      pttErrorRef.current = false;
      // T-19 (ревью): живой таймкод из videoRef на момент отпускания — иначе stale closure от рендера на pointerdown
      createComment(text, videoRef.current ? videoRef.current.currentTime : undefined);
  };
  const finishPTT = () => {
      const elapsed = Date.now() - pttStartedAtRef.current;
      if (elapsed < 400 && !pttFinalRef.current) {
          // Короткий тап без диктовки — открыть VoiceModal (десктоп-workflow)
          pttCancelRef.current = true;
          try { pttRecognitionRef.current?.abort(); } catch { /* уже остановлено */ }
          pttRecognitionRef.current = null;
          isPTTActiveRef.current = false;
          setIsPTTActive(false);
          openVoiceModal();
          return;
      }
      pttCancelRef.current = false;
      try { pttRecognitionRef.current?.stop(); } catch { /* уже остановлено */ }
  };
  const cancelPTT = () => {
      pttCancelRef.current = true;
      try { pttRecognitionRef.current?.abort(); } catch { /* уже остановлено */ }
      pttRecognitionRef.current = null;
      isPTTActiveRef.current = false;
      setIsPTTActive(false);
      setPttText("");
  };
  // T-24: фоновая диктовка в фулскрине — каждая финальная фраза → комментарий на свой таймкод
  const [isLiveDictating, setIsLiveDictating] = useState(false);
  const [liveText, setLiveText] = useState("");
  const liveRecognitionRef = useRef<any>(null);
  const isLiveRef = useRef(false);
  const startLiveDictation = () => {
      if (isLiveRef.current) return;
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) { notify(t("player.voice.unsupported"), "error"); return; }
      if (recognitionRef.current) { try { recognitionRef.current.onend = null; recognitionRef.current.onresult = null; recognitionRef.current.stop(); } catch { /* уже остановлено */ } recognitionRef.current = null; setIsListening(false); }
      cancelPTT();
      const recognition = new SpeechRecognition();
      liveRecognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = SPEECH_RECOGNITION_LANGS[language] || "en-US";
      recognition.onstart = () => { isLiveRef.current = true; setIsLiveDictating(true); };
      recognition.onresult = (event: any) => {
          let interim = "";
          const startIndex = typeof event.resultIndex === "number" ? event.resultIndex : 0;
          for (let i = startIndex; i < event.results.length; i++) {
              const result = event.results[i];
              const transcriptText = result[0].transcript as string;
              if (result.isFinal) {
                  const text = transcriptText.trim();
                  if (text) createComment(text, videoRef.current ? videoRef.current.currentTime : undefined); // фоном: фраза → комментарий на текущий таймкод
              } else interim += transcriptText;
          }
          setLiveText(interim);
      };
      recognition.onerror = (event: any) => {
          const code = event?.error;
          if (code === "not-allowed" || code === "service-not-allowed") notify(t("player.voice.err_denied"), "error");
          else if (code === "network") notify(t("player.voice.err_network"), "error");
          else if (code !== "no-speech") notify(`${t("player.voice.err_generic")}${code}`, "error");
      };
      recognition.onend = () => { isLiveRef.current = false; setIsLiveDictating(false); liveRecognitionRef.current = null; setLiveText(""); };
      try { recognition.start(); } catch (e) { console.warn("Live dictation start failed", e); }
  };
  const stopLiveDictation = () => {
      try { liveRecognitionRef.current?.stop(); } catch { /* уже остановлено */ }
  };
  // T-24: при размонтировании глушим фоновую диктовку
  useEffect(() => {
      return () => { if (liveRecognitionRef.current) { try { liveRecognitionRef.current.onend = null; liveRecognitionRef.current.abort(); } catch { /* уже остановлено */ } liveRecognitionRef.current = null; } };
  }, []);
  // T-19: при размонтировании глушим PTT-сессию
  useEffect(() => {
      return () => {
          if (pttRecognitionRef.current) {
              try { pttRecognitionRef.current.onend = null; pttRecognitionRef.current.abort(); } catch { /* уже остановлено */ }
              pttRecognitionRef.current = null;
          }
      };
  }, []);
  const handleQuickMarker = () => { if (!newCommentText.trim()) { notify(t('player.voice.need_text'), "info"); return; } setMarkerInPoint(currentTime); setMarkerOutPoint(null); handleAddComment(); }; 
  const handleSetInPoint = () => { setMarkerInPoint(currentTime); notify("In Point Set", "info"); };
  const handleSetOutPoint = () => { if (markerInPoint !== null && currentTime > markerInPoint) { setMarkerOutPoint(currentTime); notify("Out Point Set", "info"); } else notify("Out point must be after In point", "error"); };
  const clearMarkers = () => { setMarkerInPoint(null); setMarkerOutPoint(null); };
  
  const handleExport = (format: 'xml' | 'csv' | 'edl') => { 
      // REFACTORED: Check entitlements instead of hardcoded isPro check
      const entitlementKey = format === 'xml' ? 'export_xml' : 'export_csv'; // EDL currently falls under CSV-tier or XML-tier depending on policy. Using CSV for basic text formats.
      const allowed = isFeatureEnabled(config, entitlementKey, plan);

      if (!allowed && !isDemo) { 
          notify(t('upsell.founder.feat2') + " (" + t('common.upgrade_required') + ")", "warning"); 
          return; 
      }

      let content = ''; let mime = 'text/plain'; let ext = ''; 
      if (format === 'xml') { content = generateResolveXML(project.name, version.versionNumber, comments, videoFps); mime = 'application/xml'; ext = 'xml'; } 
      else if (format === 'csv') { content = generateCSV(comments); mime = 'text/csv'; ext = 'csv'; } 
      else { content = generateEDL(project.name, version.versionNumber, comments, videoFps); mime = 'text/plain'; ext = 'edl'; } 
      
      downloadFile(`${project.name}_v${version.versionNumber}.${ext}`, content, mime); 
      setShowExportMenu(false); 
  };
  
  const handleSelectCompareVersion = (idx: number | null) => { setCompareVersionIdx(idx); if (idx !== null) setViewMode('side-by-side'); else setViewMode('single'); setShowCompareMenu(false); };
  
  const handleSwitchVersion = (idx: number) => { 
      setDriveUrl(null); setVideoError(false); setDriveFileMissing(false); setDrivePermissionError(false); setDriveUrlRetried(false); setLoadingDrive(true); setCurrentVersionIdx(idx); setShowVersionSelector(false); setSelectedCommentId(null); setEditingCommentId(null);
      if (compareVersionIdx === idx) { setCompareVersionIdx(null); setViewMode('single'); } 
  };

  const scrubActive = isScrubbing || isVideoScrubbing;
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
            {isTranscribing && (
              <div data-testid="transcribe-pill" title={t('player.transcribe.pill')} className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2.5 py-1 shrink-0">
                <Wand2 size={12} className="text-indigo-400 animate-pulse" />
                <span className="text-[10px] font-bold text-indigo-300 whitespace-nowrap">{t('player.transcribe.pill')} {transcribeProgress?.status === 'downloading' ? `${Math.round(transcribeProgress.progress || 0)}%` : '…'}</span>
              </div>
            )}
            <button onClick={onBack} className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors border border-zinc-200 dark:border-zinc-700 shrink-0" title={t('back')}><CornerUpLeft size={16} /></button>
            {(!isSearchOpen || isDesktopViewport) && (
              <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 text-zinc-900 dark:text-zinc-100 leading-tight flex-1 min-w-0">
                   <div className="flex items-center gap-2 max-w-full">
                       <div className="relative group/title min-w-0" id="tour-version-selector">
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
             {/* T-08: переключатель вида доступен и на мобильных (ранее hidden md:block — единственная точка доступа к compare) */}
             <div className="block">
                 <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 mx-1"></div>
                 {/* T-18: меню поднимается до z-[100] над backdrop z-[90] (образец — version selector) */}
                 {viewMode === 'side-by-side' && compareVersion && (
                     <button onClick={() => { const cur = currentVersionIdx; if (compareVersionIdx !== null) { handleSwitchVersion(compareVersionIdx); handleSelectCompareVersion(cur); } }} className="w-10 h-10 flex items-center justify-center rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors" title={t('player.compare.swap')}><ArrowLeftRight size={18} /></button>
                 )}
                 <div className="relative"><button onClick={() => setShowMobileViewMenu(!showMobileViewMenu)} className="w-10 h-10 md:w-auto md:h-auto flex items-center justify-center p-2 rounded text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white">{viewMode === 'single' && <Monitor size={18} />}{viewMode === 'side-by-side' && <SplitSquareHorizontal size={18} />}</button>{showMobileViewMenu && (<div className="absolute top-full right-0 mt-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl p-1 flex flex-col gap-1 z-[100] min-w-[120px]" onMouseLeave={() => setShowMobileViewMenu(false)}><button onClick={() => { setViewMode('single'); setShowMobileViewMenu(false); }} className={`flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${viewMode === 'single' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-600 dark:text-zinc-400'}`}><Monitor size={14} /> Single</button><button onClick={() => { setViewMode('side-by-side'); setShowMobileViewMenu(false); }} className={`flex items-center gap-2 px-3 py-2 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${viewMode === 'side-by-side' ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-600 dark:text-zinc-400'}`}><SplitSquareHorizontal size={14} /> Split (Compare)</button></div>)}{showMobileViewMenu && <div className="fixed inset-0 z-[90]" onClick={() => setShowMobileViewMenu(false)}></div>}</div>
             </div>
          </div>
        </header>
      )}

      {/* T-18: корневой backdrop — header с backdrop-blur-md становится containing block для
          fixed-потомков (как у version selector'а — его backdrop клипуется до header), поэтому
          полноэкранное закрытие даёт этот слой: z-40 — над видео (z-30), под header (z-50) */}
      {!isFullscreen && showMobileViewMenu && (
        <div data-testid="mobile-view-menu-backdrop" className="fixed inset-0 z-40" onClick={() => setShowMobileViewMenu(false)}></div>
      )}

      {/* Body */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden relative">
        <div ref={playerContainerRef} className={`flex-1 flex flex-col bg-black lg:border-r border-zinc-800 group/fullscreen overflow-hidden transition-all duration-300 outline-none ${isFullscreen ? 'fixed inset-0 z-[100] w-screen h-screen' : 'relative'}`} tabIndex={-1}>
          {/* ... Video container ... */}
          <div className="flex-1 relative w-full h-full flex items-center justify-center bg-zinc-950 overflow-hidden group/player">
             
             {/* ... Fullscreen button ... */}
              <div className={`absolute bottom-4 right-4 z-50 flex items-center gap-2 transition-opacity duration-300 ${isFullscreen ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover/player:opacity-100'}`}>
                 {isFullscreen && (
                     <button onClick={() => setShowTxtOverlay(v => !v)} data-testid="txt-toggle" title={t('player.txt.toggle')} className={`p-2 rounded-lg backdrop-blur-sm transition-colors shadow-lg border ${showTxtOverlay ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-black/60 hover:bg-zinc-800 text-zinc-300 hover:text-white border-white/10'}`}><FileText size={20} /></button>
                 )}
                 {isFullscreen && (
                     <button onClick={() => { if (isLiveDictating) stopLiveDictation(); else startLiveDictation(); }} data-testid="live-mic" title={t('player.live.mic')} className={`p-2 rounded-lg backdrop-blur-sm transition-colors shadow-lg border ${isLiveDictating ? 'bg-red-600 text-white border-red-500 animate-pulse' : 'bg-black/60 hover:bg-zinc-800 text-zinc-300 hover:text-white border-white/10'}`}>{isLiveDictating ? <MicOff size={20} /> : <Mic size={20} />}</button>
                 )}
                 <button onClick={() => toggleFullScreen()} className="p-2 bg-black/60 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg backdrop-blur-sm transition-colors shadow-lg" title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>{isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
              </div>
             
             <div id="tour-timecode" data-testid="scrub-timecode-chip" data-state={`${scrubActive ? "scrub" : "idle"}`} className={`absolute top-4 left-1/2 -translate-x-1/2 flex items-center bg-black/50 backdrop-blur-sm rounded-lg border border-white/10 shadow-lg z-30 select-none overflow-hidden transition-all duration-200 ${scrubActive ? 'px-1 py-1' : 'px-0.5 py-0.5 opacity-90'}`}>
                <div className={`font-mono text-white tracking-widest transition-all duration-200 ${scrubActive ? 'text-2xl md:text-3xl px-4 py-1.5' : 'text-xs px-2 py-0.5'}`}>{formatTimecode(currentTime, videoFps)}</div>
                <div className={`${scrubActive ? 'h-8' : 'h-4'} w-px bg-white/20 transition-all`}></div>
                <button onClick={cycleFps} className={`${scrubActive ? 'px-3 py-2' : 'px-1.5 py-0.5'} hover:bg-white/10 transition-colors flex items-center gap-1.5 group/fps`} title={t('player.fps')}><span className={`text-[10px] font-mono font-bold ${isFpsDetected ? 'text-indigo-400' : 'text-zinc-400 group-hover/fps:text-zinc-200'}`}>{Number.isInteger(videoFps) ? videoFps : videoFps.toFixed(2)} FPS</span></button>
             </div>


             {/* T-24: TXT-оверлей — весь транскрипт поверх затемнённого видео (фулскрин) */}
             {isFullscreen && showTxtOverlay && (
                 <div data-testid="txt-overlay" className="absolute inset-0 z-[110] bg-black/85 backdrop-blur-md pt-16 pb-24 overflow-y-auto">
                     <div className="max-w-3xl mx-auto px-4">
                         <div className="flex items-center justify-between mb-4">
                             <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t('player.txt.title')}</h3>
                             <div className="flex items-center gap-2">
                                 {transcript && transcript.length > 0 && (
                                     <button onClick={() => setPhraseMode(!phraseMode)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${phraseMode ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:text-white'}`}>{t('player.transcript.phrase_mode')}</button>
                                 )}
                                 <button onClick={() => setShowTxtOverlay(false)} className="p-2 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white" title={t('cancel')}><XIcon size={18} /></button>
                             </div>
                         </div>
                         {transcript && transcript.length > 0 ? (
                             <div className="text-sm leading-loose" data-testid="txt-overlay-words">
                                 {transcript.map((chunk: TranscriptChunk, i: number) => {
                                     const deleted = isWordDeleted(comments, chunk);
                                     const isActive = !!(chunk.timestamp && currentTime >= chunk.timestamp[0] && currentTime < chunk.timestamp[1]);
                                     const isPhraseStart = phraseMode && phraseStartIdx === i;
                                     return (
                                         <span key={i} data-testid="transcript-word" onClick={() => onWordClick(chunk, i)} className={`cursor-pointer transition-colors mr-[0.3em] ${deleted ? 'line-through text-red-400' : isActive ? 'text-indigo-300 font-semibold' : 'text-zinc-200 hover:text-white'} ${isPhraseStart ? 'underline decoration-indigo-400 decoration-2 underline-offset-4' : ''}`}>{chunk.text.trim()}</span>
                                     );
                                 })}
                             </div>
                         ) : (
                             <div className="text-center py-10" data-testid="txt-overlay-empty">
                                 <p className="text-sm text-zinc-400 mb-4">{t('player.txt.empty_hint')}</p>
                                 <button onClick={handleTranscribe} disabled={isTranscribing || loadingDrive} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold">{t('player.transcribe.pill')}</button>
                             </div>
                         )}
                     </div>
                 </div>
             )}

             {/* ... Comments Overlay ... */}
              {viewMode !== 'side-by-side' && (
             <div className="absolute bottom-24 lg:bottom-12 left-4 z-20 flex flex-col items-start gap-2 pointer-events-none w-[80%] md:w-[60%] lg:w-[40%]">
                 {activeOverlayComments.map(c => { const cl = stringToColor(c.userId); return (<div key={c.id} className="bg-black/60 text-white px-3 py-1.5 rounded-lg text-sm backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 border border-white/5 shadow-lg max-w-full break-words"><span style={{ color: cl }} className="font-bold mr-2 text-xs uppercase">{c.authorName || 'User'}:</span><span className="text-zinc-100">{c.text}</span></div>); })}
             </div>
              )}

             {/* ... Voice Modal ... */}
             {/* T-07: модалка доступна и без fullscreen (мобильные); T-18: закрытие тапом по backdrop */}
             {showVoiceModal && (
                 <div data-testid="voice-modal-backdrop" className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => closeVoiceModal(false)}>
                    <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shrink-0 ${isListening ? 'bg-red-500/20 ring-4 ring-red-500/20 scale-110' : 'bg-zinc-800 hover:bg-zinc-700'}`} onClick={toggleListening}><Mic size={20} className={`${isListening ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`} /></div>
                            <div className="flex-1 overflow-hidden">
                                <h3 className="text-sm font-bold text-white mb-1 truncate">{isListening ? t('player.voice.listening') : t('player.voice.transcript')}</h3>
                                <div className="flex items-center gap-2 text-indigo-400 font-mono text-[10px] bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-500/20 w-fit"><span>{formatTimecode(markerInPoint || currentTime, videoFps)}</span>{markerOutPoint && (<><span>→</span><span>{formatTimecode(markerOutPoint, videoFps)}</span></>)}</div>
                            </div>
                        </div>
                        <textarea value={newCommentText} onChange={(e) => handleCommentTextChange(e.target.value)} placeholder={isListening ? "Listening..." : "Type comment..."} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white text-sm focus:border-indigo-500 outline-none h-20 resize-none" autoFocus />
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
                        {drivePermissionError || version.storageType === 's3' ? <ShieldAlert size={32} className="text-orange-500" /> : <FileVideo size={32} className="text-zinc-400" />}
                    </div>
                    
                    {version.storageType === 's3' ? (
                        <>
                            <p className="text-zinc-300 font-bold text-lg mb-2">{t('player.s3.title')}</p>
                            <p className="text-xs text-zinc-500 max-w-[280px] mb-2 leading-relaxed">{t('player.s3.desc')}</p>
                            {s3ErrorDetail && (
                                <p className="text-[11px] text-orange-300 mb-4 max-w-[280px]" data-testid="s3-error-reason">
                                    {s3ErrorDetail === 'auth' ? t('player.s3.reason_auth') : s3ErrorDetail === 'config' ? t('player.s3.reason_config') : s3ErrorDetail === 'media' ? t('player.s3.reason_media') : t('player.s3.reason_network')}
                                </p>
                            )}
                            <div className="flex flex-col items-center gap-2 mb-2">
                                <button onClick={() => { setVideoError(false); setDriveUrlRetried(false); setS3ErrorDetail(null); setReloadTick(t => t + 1); }} className="bg-zinc-800 hover:bg-zinc-700 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm border border-zinc-700 cursor-pointer" data-testid="s3-retry">
                                    <RotateCcw size={16} /> {t('player.s3.retry')}
                                </button>
                                {isManager && (
                                    <button onClick={() => onBack()} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm shadow-lg shadow-indigo-900/20 cursor-pointer">
                                        <Settings2 size={16} /> {t('player.s3.check_settings')}
                                    </button>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-zinc-300 font-bold text-lg mb-2">{drivePermissionError ? "Access Restricted" : t('player.media_offline')}</p>
                            <p className="text-xs text-zinc-500 max-w-[280px] mb-6 leading-relaxed">{drivePermissionError ? "You need public access to view this Drive file in the player." : t('player.offline_desc')}</p>
                            {drivePermissionError && isManager && (<button onClick={(e) => { e.stopPropagation(); handleFixPermissions(); }} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm shadow-lg shadow-indigo-900/20 cursor-pointer mb-2"><Unlock size={16} /> Fix Permissions (Make Public)</button>)}
                        </>
                    )}
                    
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
             <div className={`relative w-full h-full flex items-center justify-center bg-black ${viewMode === 'side-by-side' ? (isDesktopViewport ? 'grid grid-cols-2 gap-1' : 'grid grid-cols-1 gap-2 overflow-y-auto') : ''}`}>
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                    {viewMode === 'side-by-side' && <div className="absolute top-4 left-4 z-10 bg-black/60 text-white px-2 py-1 rounded text-xs font-bold pointer-events-none">A · v{version.versionNumber}</div>}
                    <video key={version.id} ref={videoRef} src={localFileSrc || driveUrl || version.url} className="w-full h-full object-contain pointer-events-none" onTimeUpdate={handleTimeUpdate} onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setVideoError(false); setIsFpsDetected(false); setIsVerticalVideo(e.currentTarget.videoHeight > e.currentTarget.videoWidth); }} onError={handleVideoError} onEnded={() => setIsPlaying(false)} playsInline controls={false} />
                </div>
                {viewMode === 'side-by-side' && compareVersion && (<div className="relative w-full h-full flex items-center justify-center overflow-hidden border-l border-zinc-800"><div className="absolute top-4 right-4 z-10 bg-black/60 text-indigo-400 px-2 py-1 rounded text-xs font-bold pointer-events-none">B · v{compareVersion.versionNumber}</div><video ref={compareVideoRef} src={compareVersion.url} className="w-full h-full object-contain pointer-events-none" muted playsInline controls={false} /></div>)}
                {/* T-18: onPointerCancel/onLostPointerCapture — iOS-системный жест обрывает скраб, safeEnd выводит из режима */}
                <div data-testid="video-scrub-overlay" className={`absolute inset-0 z-30 touch-none ${isVideoScrubbing ? 'cursor-grabbing' : 'cursor-default hover:cursor-grab'}`} onPointerDown={handleVideoDragStart} onPointerMove={handleVideoDragMove} onPointerUp={handleVideoDragEnd} onPointerCancel={handleVideoDragEnd} onLostPointerCapture={handleVideoDragEnd} onPointerLeave={handleVideoDragEnd}></div>
             </div>
          </div>

          <div className={`${isVerticalVideo ? 'absolute bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-black via-black/80 to-transparent pb-6 pt-10' : 'bg-zinc-900 border-t border-zinc-800 pb-2'} p-2 lg:p-4 shrink-0 transition-transform duration-300`}>
             {/* T-18: onPointerCancel/onLostPointerCapture — safeEnd и для таймлайна */}
             <div id="tour-timeline" className="relative h-8 md:h-8 group cursor-pointer flex items-center touch-none" ref={timelineRef} onPointerDown={handleTimelinePointerDown} onPointerMove={handleTimelinePointerMove} onPointerUp={handleTimelinePointerUp} onPointerCancel={handleTimelinePointerUp} onLostPointerCapture={handleTimelinePointerUp} onPointerLeave={handleTimelinePointerUp}>
                <div className="w-full h-2 md:h-1.5 bg-zinc-700/50 rounded-full overflow-hidden relative"><div className="h-full bg-indigo-500" style={{ width: `${(currentTime / duration) * 100}%` }} /></div>
                {filteredComments.map(c => { const l = (c.timestamp / duration) * 100; const w = c.duration ? (c.duration / duration) * 100 : 0.5; const cl = stringToColor(c.userId); return (<div key={c.id} className={`absolute top-1/2 -translate-y-1/2 h-4 md:h-2.5 rounded-sm z-10 opacity-80 pointer-events-none`} style={{ left: `${l}%`, width: `${Math.max(0.5, w)}%`, minWidth: '4px', backgroundColor: (c as any).editKind === 'delete' ? '#ef4444' : (c.status === 'resolved' ? '#22c55e' : cl) }} />); })}
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
                setTranscript={setTranscript} seekByFrame={seekByFrame} videoFps={videoFps} t={t}
                phraseMode={phraseMode} setPhraseMode={setPhraseMode} phraseStartIdx={phraseStartIdx} setPhraseStartIdx={setPhraseStartIdx} onWordClick={onWordClick} comments={comments}
            />
        )}

        {!isFullscreen && sidebarTab === 'comments' && (
            <div className="fixed bottom-0 left-0 right-0 lg:left-auto lg:right-0 lg:w-80 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 z-50 p-2 pb-[env(safe-area-inset-bottom)] transition-[bottom] shadow-[0_-5px_15px_rgba(0,0,0,0.05)] dark:shadow-[0_-5px_15px_rgba(0,0,0,0.5)]" style={{ bottom: kbLift ? `${kbLift}px` : undefined }}>
                {(markerInPoint !== null || markerOutPoint !== null) ? (
                    <div className="flex items-center gap-2 mb-2 px-1"><div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/20 uppercase"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div><span>Range: {formatTimecode(markerInPoint || currentTime, videoFps)} - {markerOutPoint ? formatTimecode(markerOutPoint, videoFps) : '...'}</span></div></div>
                ) : (
                    <div className="flex items-center gap-2 mb-2 px-1" data-testid="comment-context">
                        <div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/20">
                            <MapPin size={9} />
                            <span>{t('player.comment.context')} {formatTimecode(currentTime, videoFps)}</span>
                        </div>
                    </div>
                )}
                <div className="flex gap-2 items-start" id="tour-comment-input">
                    <div className="relative flex-1">
                        <input ref={sidebarInputRef} disabled={isLocked} className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg pl-3 pr-8 py-3 text-sm text-zinc-900 dark:text-white focus:border-indigo-500 focus:bg-white dark:focus:bg-zinc-900 outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all" placeholder={isLocked ? t('player.comments_locked') : (isListening ? t('player.voice.listening') : t('player.voice.placeholder'))} value={newCommentText} onChange={e => handleCommentTextChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment()} onFocus={(e) => { setTimeout(() => { e.target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300); }} />
                        <button onClick={toggleListening} disabled={isLocked} className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-white disabled:opacity-30'}`}>{isListening ? <MicOff size={16} /> : <Mic size={16} />}</button>
                    </div>
                    <button onClick={handleAddComment} disabled={!newCommentText.trim() || isLocked} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white p-3 rounded-lg transition-colors shrink-0 disabled:cursor-not-allowed shadow-sm"><Send size={16} /></button>
                </div>
            </div>
        )}
      </div>

      <FloatingControls 
        initialPos={controlsPos}
        onPositionChange={setControlsPos}
        isLocked={isLocked}
        t={t}
        handleQuickMarker={handleQuickMarker}
        seek={seek}
        handleSetInPoint={handleSetInPoint}
        handleSetOutPoint={handleSetOutPoint}
        markerInPoint={markerInPoint}
        markerOutPoint={markerOutPoint}
        clearMarkers={clearMarkers}
        openVoiceModal={openVoiceModal}
        isListening={isListening}
                isPTTActive={isPTTActive || isLiveDictating} pttText={liveText || pttText}
        onMicPointerDown={startPTT}
        onMicPointerUp={finishPTT}
      />
    </div>
  );
};
