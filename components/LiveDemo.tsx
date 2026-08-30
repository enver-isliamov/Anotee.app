
import React, { useState, useEffect } from 'react';
import { Player } from './Player';
import { Project, User, CommentStatus } from '../types';
import { ToastContainer, ToastMessage, ToastType } from './Toast';
import { generateId } from '../services/utils';
import { generateInitialsAvatar } from '../services/avatarUtils';
import { useLanguage } from '../services/i18n';
import { Film, Sparkles } from 'lucide-react';

interface LiveDemoProps {
    onBack: () => void;
}

const DEMO_USER: User = {
    id: 'demo-user',
    name: 'You (Demo User)',
    avatar: generateInitialsAvatar('DemoUser')
};

const INITIAL_DEMO_PROJECT: Project = {
    id: 'demo-project',
    name: 'Anotee - Open Source Demo Reel',
    description: 'Интерактивное рабочее демо платформы Anotee с открытыми видеофайлами без авторских прав (Creative Commons CC-BY).',
    client: 'Demo Production',
    createdAt: Date.now(),
    updatedAt: 'Только что',
    ownerId: 'demo-owner',
    team: [
        DEMO_USER,
        { id: 'u2', name: 'Режиссер (Director)', avatar: generateInitialsAvatar('Режиссер (Director)') },
        { id: 'u3', name: 'Колорист (Colorist)', avatar: generateInitialsAvatar('Колорист (Colorist)') }
    ],
    assets: [
        {
            id: 'demo-asset-1',
            title: 'Sintel Open Movie (Animation Reel)',
            thumbnail: '/img/demo-video-1.jpg', // локальная копия (unsplash недоступен из РФ, T-17)
            currentVersionIndex: 1, // Start at v2 to showcase version comparison
            versions: [
                {
                    id: 'v1',
                    versionNumber: 1,
                    filename: 'sintel_trailer_v1.mp4',
                    url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
                    uploadedAt: 'Вчера',
                    comments: []
                },
                {
                    id: 'v2',
                    versionNumber: 2,
                    filename: 'sintel_trailer_v2_final.mp4',
                    url: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
                    uploadedAt: 'Сегодня',
                    comments: [
                        {
                            id: 'c1',
                            userId: 'u2',
                            authorName: 'Режиссер (Director)',
                            timestamp: 2.5,
                            text: 'Добро пожаловать в живое демо Anotee! 👋\nПопробуйте кликнуть на таймлайн или поставить паузу, чтобы добавить точный кадр с комментарием или рисунком.',
                            status: CommentStatus.OPEN,
                            createdAt: 'Только что'
                        },
                        {
                            id: 'c2',
                            userId: 'u3',
                            authorName: 'Колорист (Colorist)',
                            timestamp: 9.5,
                            duration: 4,
                            text: 'Заметьте плашку диапазона (In/Out markers) на таймлайне ниже! Используйте клавиши "I" и "O" для установки начала и конца фрагмента.',
                            status: CommentStatus.RESOLVED,
                            createdAt: '10 мин назад'
                        }
                    ]
                }
            ]
        },
        {
            id: 'demo-asset-2',
            title: 'Oceans Nature (HD Commercial Demo)',
            thumbnail: '/img/demo-video-2.jpg', // локальная копия (unsplash недоступен из РФ, T-17)
            currentVersionIndex: 0,
            versions: [
                {
                    id: 'v1_tos',
                    versionNumber: 1,
                    filename: 'oceans_hd_commercial.mp4',
                    url: 'https://vjs.zencdn.net/v/oceans.mp4',
                    uploadedAt: 'Сегодня',
                    comments: [
                        {
                            id: 'c3',
                            userId: 'u2',
                            authorName: 'Режиссер (Director)',
                            timestamp: 15,
                            text: 'Проверьте цветокоррекцию подводного кадра в этом ролике. Можно использовать инструмент рисования прямо поверх видео!',
                            status: CommentStatus.OPEN,
                            createdAt: '2 часа назад'
                        }
                    ]
                }
            ]
        }
    ]
};

export const LiveDemo: React.FC<LiveDemoProps> = ({ onBack }) => {
    const [project, setProject] = useState<Project>(INITIAL_DEMO_PROJECT);
    const [activeAssetIndex, setActiveAssetIndex] = useState<number>(0);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const { t } = useLanguage();

    const notify = (message: string, type: ToastType = 'info') => {
        const id = generateId();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const handleUpdateProject = (updatedProject: Project, skipSync?: boolean) => {
        setProject(updatedProject);
        if (!skipSync) {
            console.log("Demo: Изменения сохранены локально");
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            notify("Вы находитесь в интерактивном Демо-режиме с видео без авторских прав (CC-BY). Протестируйте все функции!", "success");
        }, 400);
        return () => clearTimeout(timer);
    }, []);

    const activeAsset = project.assets[activeAssetIndex] || project.assets[0];

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-black">
            <Player 
                asset={activeAsset}
                project={project}
                currentUser={DEMO_USER}
                onBack={onBack}
                users={project.team}
                onUpdateProject={handleUpdateProject}
                isSyncing={false}
                notify={notify}
                isDemo={true}
            />
            
            {/* Top Bar Floating Asset Selector for Live Demo */}
            {project.assets.length > 1 && (
                <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-md p-1.5 rounded-full border border-zinc-700/60 shadow-xl">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2.5 flex items-center gap-1">
                        <Film size={12} className="text-indigo-400" />
                        Демо Ассеты:
                    </span>
                    {project.assets.map((assetItem, idx) => (
                        <button
                            key={assetItem.id}
                            onClick={() => setActiveAssetIndex(idx)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                activeAssetIndex === idx 
                                    ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                                    : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                            }`}
                        >
                            <span>{assetItem.title.split(' ')[0]}</span>
                            {activeAssetIndex === idx && <Sparkles size={11} />}
                        </button>
                    ))}
                </div>
            )}

            {/* Demo Overlay Badge */}
            <div className="fixed bottom-20 left-4 z-[9998] pointer-events-none">
                <div className="bg-indigo-600/70 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-md border border-indigo-400/30 shadow-md">
                    LIVE DEMO MODE
                </div>
            </div>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
};
