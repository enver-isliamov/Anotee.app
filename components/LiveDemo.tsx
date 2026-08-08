
import React, { useState, useEffect } from 'react';
import { Player } from './Player';
import { Project, User, CommentStatus } from '../types';
import { ToastContainer, ToastMessage, ToastType } from './Toast';
import { generateId } from '../services/utils';
import { useLanguage } from '../services/i18n';
import { Film, Sparkles } from 'lucide-react';

interface LiveDemoProps {
    onBack: () => void;
}

const DEMO_USER: User = {
    id: 'demo-user',
    name: 'You (Demo User)',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser'
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
        { id: 'u2', name: 'Режиссер (Director)', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Director' },
        { id: 'u3', name: 'Колорист (Colorist)', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Colorist' }
    ],
    assets: [
        {
            id: 'demo-asset-1',
            title: 'Big Buck Bunny (Animation Reel)',
            thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
            currentVersionIndex: 1, // Start at v2 to showcase version comparison
            versions: [
                {
                    id: 'v1',
                    versionNumber: 1,
                    filename: 'big_buck_bunny_v1_rough.mp4',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                    uploadedAt: 'Вчера',
                    comments: []
                },
                {
                    id: 'v2',
                    versionNumber: 2,
                    filename: 'big_buck_bunny_v2_final.mp4',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
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
            title: 'Tears of Steel (VFX Demo)',
            thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/TearsOfSteel.jpg',
            currentVersionIndex: 0,
            versions: [
                {
                    id: 'v1_tos',
                    versionNumber: 1,
                    filename: 'tears_of_steel_1080p.mp4',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
                    uploadedAt: 'Сегодня',
                    comments: [
                        {
                            id: 'c3',
                            userId: 'u2',
                            authorName: 'Режиссер (Director)',
                            timestamp: 15,
                            text: 'Проверьте цветокоррекцию на крупном плане робота в этом файле. Можно использовать инструмент рисования прямо поверх кадра!',
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
