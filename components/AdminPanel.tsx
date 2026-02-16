
import React, { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Shield, ArrowLeft, Settings, Crown, Layout, CreditCard, TrendingUp, FlaskConical, PenTool } from 'lucide-react';
import { AdminStrategyTab } from './admin/AdminStrategyTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminFeaturesTab } from './admin/AdminFeaturesTab';
import { AdminPaymentsTab } from './admin/AdminPaymentsTab';
import { AdminContentTab } from './admin/AdminContentTab';

export const AdminPanel: React.FC<{ onBack: () => void, onNavigate?: (page: string) => void }> = ({ onBack, onNavigate }) => {
    const { userId: currentUserId } = useAuth();
    const [activeTab, setActiveTab] = useState<'users' | 'features' | 'payments' | 'strategy' | 'content'>('users');

    return (
        <div className="w-full mx-auto py-4 md:py-8 px-3 md:px-4 font-sans text-zinc-900 dark:text-zinc-100 pb-24">
            {/* Header */}
            <div className="flex flex-col gap-6 mb-8">
                {/* ... Header Buttons ... */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                            <ArrowLeft size={20} className="text-zinc-600 dark:text-zinc-400"/>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Shield size={24} className="text-indigo-600 dark:text-indigo-400"/> 
                                Admin Dashboard
                            </h1>
                        </div>
                    </div>
                    {/* TEST RUNNER BUTTON */}
                    <div className="flex items-center gap-2">
                        {onNavigate && (
                            <button 
                                onClick={() => onNavigate('TEST_RUNNER')}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-lg font-bold text-sm transition-all shadow-sm"
                            >
                                <FlaskConical size={16} />
                                System Tests
                            </button>
                        )}
                        <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold border border-green-200 dark:border-green-800">
                            Super Admin
                        </div>
                    </div>
                </div>
                
                {/* Main Tabs */}
                <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-xl w-full max-w-3xl overflow-x-auto gap-1">
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold rounded-lg transition-all min-w-[100px] ${activeTab === 'users' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        <Crown size={16} /> Пользователи
                    </button>
                    <button 
                        onClick={() => setActiveTab('features')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold rounded-lg transition-all min-w-[100px] ${activeTab === 'features' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        <Settings size={16} /> Настройки
                    </button>
                    <button 
                        onClick={() => setActiveTab('payments')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold rounded-lg transition-all min-w-[100px] ${activeTab === 'payments' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        <CreditCard size={16} /> Интеграции
                    </button>
                    <button 
                        onClick={() => setActiveTab('strategy')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold rounded-lg transition-all min-w-[100px] ${activeTab === 'strategy' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        <TrendingUp size={16} /> Стратегия
                    </button>
                    <button 
                        onClick={() => setActiveTab('content')}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold rounded-lg transition-all min-w-[100px] ${activeTab === 'content' ? 'bg-white dark:bg-zinc-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'}`}
                    >
                        <PenTool size={16} /> Контент
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'strategy' && <AdminStrategyTab />}
            {activeTab === 'users' && <AdminUsersTab currentUserId={currentUserId} />}
            {activeTab === 'features' && <AdminFeaturesTab />}
            {activeTab === 'payments' && <AdminPaymentsTab />}
            {activeTab === 'content' && <AdminContentTab />}
        </div>
    );
};
