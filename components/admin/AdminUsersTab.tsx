
import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { AdminUser, UserPlan } from '../../types';
import { RefreshCw, Search, Crown, CheckCircle, Zap, Shield, Filter, Repeat } from 'lucide-react';
import { getPlanLabel, getPlanBadgeClass, getPlanIcon } from '../../services/planLabels';

export const AdminUsersTab: React.FC<{ currentUserId: string | null | undefined }> = ({ currentUserId }) => {
    const { getToken } = useAuth();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [usersLoading, setUsersLoading] = useState(true);
    const [userError, setUserError] = useState('');
    const [filterPlan, setFilterPlan] = useState<'all' | UserPlan>('all');
    
    // Modal State
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [targetPlan, setTargetPlan] = useState<UserPlan>('pro'); // default
    const [grantDuration, setGrantDuration] = useState<number>(30); // days
    const [isGranting, setIsGranting] = useState(false);

    // Stats based on enriched fields if available, or fallback
    const totalUsers = users.length;
    const proUsers = users.filter(u => u.plan === 'pro').length;
    const lifetimeUsers = users.filter(u => u.plan === 'lifetime').length;
    
    const fetchUsers = async () => {
        setUsersLoading(true);
        setUserError('');
        try {
            const token = await getToken();
            const res = await fetch('/api/admin?action=users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Не удалось загрузить пользователей.");
            const data = await res.json();
            setUsers(data.users || []);
            setFilteredUsers(data.users || []);
        } catch (e: any) {
            setUserError(e.message);
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        let result = users;

        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            result = result.filter(u => 
                u.name.toLowerCase().includes(lower) || 
                u.email.toLowerCase().includes(lower)
            );
        }

        if (filterPlan !== 'all') {
            result = result.filter(u => u.plan === filterPlan);
        }

        setFilteredUsers(result);
    }, [searchQuery, users, filterPlan]);

    const handleSetPlan = async () => {
        if (!selectedUser) return;
        setIsGranting(true);
        try {
            const token = await getToken();
            
            await fetch('/api/admin?action=set_plan', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: selectedUser.id, 
                    plan: targetPlan,
                    days: targetPlan === 'pro' ? grantDuration : undefined
                })
            });

            setSelectedUser(null);
            fetchUsers();
        } catch (e) {
            alert("Ошибка при изменении плана");
        } finally {
            setIsGranting(false);
        }
    };

    const handleToggleAdmin = async (user: AdminUser) => {
        if (user.id === currentUserId) return; // Prevent self-removal
        if (!confirm(user.isAdmin ? `Снять админа с ${user.name}?` : `Сделать ${user.name} админом?`)) return;
        
        try {
            const token = await getToken();
            await fetch('/api/admin?action=toggle_admin', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: user.id, makeAdmin: !user.isAdmin })
            });
            fetchUsers();
        } catch (e) {
            alert("Ошибка изменения роли");
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm">
                    <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">Всего</div>
                    <div className="text-3xl font-bold">{totalUsers}</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-500/20 p-4 rounded-xl shadow-sm">
                    <div className="text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1">Lifetime</div>
                    <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">{lifetimeUsers}</div>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 p-4 rounded-xl shadow-sm hidden md:block">
                    <div className="text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider mb-1">Pro Sub</div>
                    <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">{proUsers}</div>
                </div>
                <div className="col-span-2 md:col-span-1 flex items-center justify-center p-3">
                     <button onClick={fetchUsers} className="w-full h-full flex items-center justify-center gap-2 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-sm font-bold transition-colors text-zinc-600 dark:text-zinc-300">
                        <RefreshCw size={16} className={usersLoading ? "animate-spin" : ""} /> Обновить список
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <input 
                        type="text" 
                        placeholder="Поиск по имени или email..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 transition-colors shadow-sm"
                    />
                    <Search size={18} className="absolute left-3 top-2.5 text-zinc-400" />
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                    <button onClick={() => setFilterPlan('all')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap border ${filterPlan === 'all' ? 'bg-zinc-800 text-white border-zinc-800' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}>All</button>
                    <button onClick={() => setFilterPlan('lifetime')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap border ${filterPlan === 'lifetime' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}>Lifetime</button>
                    <button onClick={() => setFilterPlan('pro')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap border ${filterPlan === 'pro' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}>Pro</button>
                    <button onClick={() => setFilterPlan('free')} className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap border ${filterPlan === 'free' ? 'bg-zinc-200 text-zinc-700 border-zinc-300' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'}`}>Free</button>
                </div>
            </div>

            {userError && <div className="p-4 bg-red-100 text-red-700 rounded-lg mb-4 text-xs">{userError}</div>}

            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs">Пользователь</th>
                                <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs">План</th>
                                <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs">Роль</th>
                                <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs text-right">Действия</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {filteredUsers.map((user) => {
                                const PlanIcon = getPlanIcon(user.plan);
                                
                                return (
                                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-3">
                                                <img src={user.avatar} className="w-8 h-8 rounded-full bg-zinc-200 object-cover" alt="" />
                                                <div>
                                                    <div className="font-bold text-zinc-900 dark:text-white text-xs md:text-sm">{user.name}</div>
                                                    <div className="text-[10px] text-zinc-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getPlanBadgeClass(user.plan)}`}>
                                                    <PlanIcon size={10} fill="currentColor" /> {user.planLabel ? user.planLabel.toUpperCase() : getPlanLabel(user.plan).toUpperCase()}
                                                </span>
                                                {/* Show Auto-Renew Indicator using the new field */}
                                                {user.isRecurringEligible && (
                                                    <div className="p-1 text-indigo-500 dark:text-indigo-400" title="Auto-Renew Active">
                                                        <Repeat size={12} />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            {user.isAdmin && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold border border-green-200 dark:border-green-800">
                                                    <Shield size={10} /> ADMIN
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-right flex justify-end gap-2">
                                            <button onClick={() => setSelectedUser(user)} className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg text-xs font-bold transition-colors">
                                                Изменить план
                                            </button>
                                            
                                            {user.id !== currentUserId && (
                                                <button 
                                                    onClick={() => handleToggleAdmin(user)} 
                                                    className={`p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${user.isAdmin ? 'text-red-500' : 'text-zinc-400'}`}
                                                    title={user.isAdmin ? "Снять права Админа" : "Сделать Админом"}
                                                >
                                                    <Shield size={14} fill={user.isAdmin ? "currentColor" : "none"} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Grant Modal */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                        <div className="flex items-center gap-3 mb-4 text-zinc-900 dark:text-white">
                            <Crown size={24} className="text-indigo-500"/>
                            <h2 className="text-lg font-bold">Назначить план</h2>
                        </div>
                        
                        <div className="mb-6 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3 mb-4">
                                <img src={selectedUser.avatar} className="w-8 h-8 rounded-full" alt="" />
                                <div className="min-w-0">
                                    <div className="font-bold text-xs text-zinc-900 dark:text-white truncate">{selectedUser.name}</div>
                                    <div className="text-[10px] text-zinc-500 truncate">{selectedUser.email}</div>
                                </div>
                            </div>
                            
                            <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1.5">Выберите план</label>
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                <button 
                                    onClick={() => setTargetPlan('free')}
                                    className={`py-2 text-xs font-bold rounded-lg border ${targetPlan === 'free' ? 'bg-zinc-200 border-zinc-300 text-black' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500'}`}
                                >
                                    Free
                                </button>
                                <button 
                                    onClick={() => setTargetPlan('pro')}
                                    className={`py-2 text-xs font-bold rounded-lg border ${targetPlan === 'pro' ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500'}`}
                                >
                                    Pro
                                </button>
                                <button 
                                    onClick={() => setTargetPlan('lifetime')}
                                    className={`py-2 text-xs font-bold rounded-lg border ${targetPlan === 'lifetime' ? 'bg-amber-100 border-amber-200 text-amber-700' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500'}`}
                                >
                                    Lifetime
                                </button>
                            </div>

                            {targetPlan === 'pro' && (
                                <>
                                    <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1.5">Срок действия</label>
                                    <select 
                                        value={grantDuration} 
                                        onChange={(e) => setGrantDuration(parseInt(e.target.value))}
                                        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                                    >
                                        <option value={7}>7 Дней (Триал)</option>
                                        <option value={30}>1 Месяц</option>
                                        <option value={365}>1 Год</option>
                                    </select>
                                </>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setSelectedUser(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Отмена</button>
                            <button onClick={handleSetPlan} disabled={isGranting} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all">
                                {isGranting ? <RefreshCw size={14} className="animate-spin"/> : <CheckCircle size={14}/>} Сохранить
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
