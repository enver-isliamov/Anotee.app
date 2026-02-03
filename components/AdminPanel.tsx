
import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Shield, RefreshCw, CheckCircle, XCircle, CreditCard, Calendar, ArrowLeft } from 'lucide-react';

interface AdminUser {
    id: string;
    name: string;
    email: string;
    avatar: string;
    plan: 'free' | 'pro';
    expiresAt: number | null;
    isAutoRenew: boolean;
    lastActive: number;
}

export const AdminPanel: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { getToken } = useAuth();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const token = await getToken();
            const res = await fetch('/api/admin?action=users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) throw new Error("Failed to fetch users. Are you an admin?");
            
            const data = await res.json();
            setUsers(data.users || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Stats
    const totalUsers = users.length;
    const proUsers = users.filter(u => u.plan === 'pro').length;
    const activeSubs = users.filter(u => u.plan === 'pro' && u.isAutoRenew).length;

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                        <ArrowLeft size={20} className="text-zinc-600 dark:text-zinc-400"/>
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <Shield className="text-indigo-600" /> Admin Dashboard
                        </h1>
                        <p className="text-sm text-zinc-500">Overview of user base and subscriptions</p>
                    </div>
                </div>
                <button 
                    onClick={fetchUsers} 
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-sm font-bold transition-colors"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl">
                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Total Users</div>
                    <div className="text-3xl font-bold text-zinc-900 dark:text-white">{totalUsers}</div>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-500/20 p-4 rounded-xl">
                    <div className="text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">Pro Accounts</div>
                    <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">{proUsers}</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-500/20 p-4 rounded-xl">
                    <div className="text-green-600 dark:text-green-400 text-xs font-bold uppercase tracking-wider mb-1">Active Subscriptions</div>
                    <div className="text-3xl font-bold text-green-700 dark:text-green-300">{activeSubs}</div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl text-red-600 dark:text-red-400 text-sm mb-6 flex items-center gap-2">
                    <XCircle size={16} /> {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                            <tr>
                                <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs">User</th>
                                <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs">Plan</th>
                                <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs">Expires</th>
                                <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs">Auto-Renew</th>
                                <th className="px-6 py-3 font-bold text-zinc-500 uppercase text-xs">Last Active</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {users.map((user) => {
                                const isPro = user.plan === 'pro';
                                const expiryDate = user.expiresAt ? new Date(user.expiresAt) : null;
                                const isExpired = expiryDate && expiryDate.getTime() < Date.now();
                                
                                return (
                                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <img src={user.avatar} className="w-8 h-8 rounded-full bg-zinc-200" alt="" />
                                                <div>
                                                    <div className="font-bold text-zinc-900 dark:text-white">{user.name}</div>
                                                    <div className="text-xs text-zinc-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {isPro ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-500/20">
                                                    <Shield size={10} /> PRO
                                                </span>
                                            ) : (
                                                <span className="text-zinc-500 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">FREE</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                                            {expiryDate ? (
                                                <span className={isExpired ? "text-red-500" : ""}>
                                                    {expiryDate.toLocaleDateString()}
                                                </span>
                                            ) : (
                                                isPro ? <span className="text-green-500">Lifetime</span> : "-"
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.isAutoRenew ? (
                                                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-bold">
                                                    <CreditCard size={12} /> Active
                                                </div>
                                            ) : (
                                                <span className="text-zinc-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-500 text-xs">
                                            {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}
                                        </td>
                                    </tr>
                                );
                            })}
                            {users.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">No users found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
