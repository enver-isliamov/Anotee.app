
import React, { useState, useEffect } from 'react';
import { Player } from './Player';
import { Project, User, UserRole, CommentStatus } from '../types';
import { ToastContainer, ToastMessage, ToastType } from './Toast';
import { generateId } from '../services/utils';
import { useLanguage } from '../services/i18n';

interface LiveDemoProps {
    onBack: () => void;
}

const DEMO_USER: User = {
    id: 'demo-user',
    name: 'You (Demo)',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser',
    role: UserRole.CREATOR
};

const INITIAL_DEMO_PROJECT: Project = {
    id: 'demo-project',
    name: 'SmoTree - Commercial Demo',
    description: 'This is a live demo environment. Changes are local and temporary.',
    client: 'Demo Corp',
    createdAt: Date.now(),
    updatedAt: 'Just now',
    ownerId: 'demo-owner',
    team: [
        DEMO_USER,
        { id: 'u2', name: 'Director', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Director', role: UserRole.ADMIN }
    ],
    assets: [
        {
            id: 'demo-asset-1',
            title: 'Big Buck Bunny (Short)',
            thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
            currentVersionIndex: 1, // Start at v2 to show comparison potential
            versions: [
                {
                    id: 'v1',
                    versionNumber: 1,
                    filename: 'big_buck_bunny_720p.mp4',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', // Use same URL for demo simplicity, but imagine it's rough cut
                    uploadedAt: 'Yesterday',
                    comments: []
                },
                {
                    id: 'v2',
                    versionNumber: 2,
                    filename: 'big_buck_bunny_1080p.mp4',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                    uploadedAt: 'Today',
                    comments: [
                        {
                            id: 'c1',
                            userId: 'u2',
                            authorName: 'Director',
                            timestamp: 2,
                            text: 'Welcome to the SmoTree Live Demo! 👋\nTry playing the video and adding your own comments.',
                            status: CommentStatus.OPEN,
                            createdAt: 'Just now'
                        },
                        {
                            id: 'c2',
                            userId: 'u2',
                            authorName: 'Director',
                            timestamp: 9.5,
                            duration: 4,
                            text: 'Notice the range marker on the timeline below? Use "I" and "O" keys to set In/Out points.',
                            status: CommentStatus.RESOLVED,
                            createdAt: '5 mins ago'
                        }
                    ]
                }
            ]
        }
    ]
};

export const LiveDemo: React.FC<LiveDemoProps> = ({ onBack }) => {
    const [project, setProject] = useState<Project>(INITIAL_DEMO_PROJECT);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    const { t } = useLanguage();

    const notify = (message: string, type: ToastType = 'info') => {
        const id = generateId();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // Mock update function that updates local state only
    const handleUpdateProject = (updatedProject: Project, skipSync?: boolean) => {
        setProject(updatedProject);
        if (!skipSync) {
            // Simulate saving
            console.log("Demo: Saved changes locally");
        }
    };

    useEffect(() => {
        // Initial welcome toast
        setTimeout(() => {
            notify("Welcome to Live Demo mode! Feel free to test everything.", "success");
        }, 500);
    }, []);

    const asset = project.assets[0];

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-black">
            <Player 
                asset={asset}
                project={project}
                currentUser={DEMO_USER}
                onBack={onBack}
                users={project.team}
                onUpdateProject={handleUpdateProject}
                isSyncing={false}
                notify={notify}
                isDemo={true}
            />
            
            {/* Demo Overlay Badge - Smaller, less blinking, bottom left */}
            <div className="fixed bottom-20 left-4 z-[9998] pointer-events-none">
                <div className="bg-indigo-600/50 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-indigo-400/20 opacity-80">
                    LIVE DEMO MODE
                </div>
            </div>

            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
    );
};
