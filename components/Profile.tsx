
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Crown, Database, Check, AlertCircle, LogOut } from 'lucide-react';
import { RoadmapBlock } from './RoadmapBlock';
import { useLanguage } from '../services/i18n';
import { UserProfile, useAuth } from '@clerk/clerk-react';

interface ProfileProps {
  currentUser: User;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ currentUser, onLogout }) => {
  const { t } = useLanguage();
  const { getToken } = useAuth();
  
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [migratedCount, setMigratedCount] = useState(0);

  const handleMigrate = async () => {
      setMigrationStatus('loading');
      setErrorMessage('');
      try {
          const token = await getToken();
          const res = await fetch('/api/migrate', {
              method: 'POST',
              headers: {
                  'Authorization': `Bearer ${token}`
              }
          });

          const data = await res.json();

          if (!res.ok) {
              throw new Error(data.details || data.error || "Migration failed");
          }
          
          setMigratedCount(data.updatedProjects || 0);
          setMigrationStatus('success');
      } catch (e: any) {
          console.error(e);
          setErrorMessage(e.message);
          setMigrationStatus('error');
      }
  };

  return (
        <div className="max-w-5xl mx-auto space-y-8 py-8 animate-in fade-in duration-500 pb-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                 <div>
                     <h2 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        {t('profile.title')}
                        {currentUser.role === UserRole.ADMIN && <Crown size={20} className="text-yellow-500" fill="currentColor" />}
                     </h2>
                     <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Manage your account settings and subscriptions.</p>
                 </div>
                 
                 <button 
                    onClick={onLogout}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-sm font-bold transition-colors border border-red-200 dark:border-red-900/50"
                 >
                    <LogOut size={16} />
                    {t('logout')}
                 </button>
            </div>
            
            {/* Clerk User Profile - Full Mode */}
            <div className="flex justify-center">
                <UserProfile 
                    routing="hash"
                    appearance={{
                        elements: {
                            rootBox: "w-full shadow-none",
                            card: "w-full shadow-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden",
                            navbar: "border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900",
                            navbarButton: "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                            activeNavbarButton: "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400",
                            headerTitle: "text-zinc-900 dark:text-white",
                            headerSubtitle: "text-zinc-500 dark:text-zinc-400",
                            profileSectionTitleText: "text-zinc-900 dark:text-white font-bold",
                            userPreviewMainIdentifier: "text-zinc-900 dark:text-white font-bold",
                            userPreviewSecondaryIdentifier: "text-zinc-500 dark:text-zinc-400",
                            socialButtonsBlockButton: "text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800",
                            formFieldLabel: "text-zinc-700 dark:text-zinc-300",
                            formFieldInput: "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white",
                            footer: "hidden" 
                        },
                        variables: {
                            colorPrimary: "#4f46e5", 
                            colorBackground: "transparent",
                            colorText: "inherit",
                        }
                    }}
                />
            </div>

            {/* Migration Tool (Admins Only) */}
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <Database size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-zinc-900 dark:text-white mb-1">Legacy Data Recovery</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                            If you created projects before the update, run this tool to link them to your new account.
                        </p>
                        
                        {migrationStatus === 'success' ? (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-bold bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg border border-green-200 dark:border-green-800">
                                <Check size={16} /> Optimization Complete ({migratedCount} projects scanned)
                            </div>
                        ) : migrationStatus === 'error' ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-bold bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800">
                                    <AlertCircle size={16} /> Error: {errorMessage || "Unknown error"}
                                </div>
                                <button onClick={handleMigrate} className="text-xs text-indigo-500 hover:underline text-left mt-1">Try again</button>
                            </div>
                        ) : (
                            <button 
                                onClick={handleMigrate} 
                                disabled={migrationStatus === 'loading'}
                                className="bg-zinc-900 dark:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {migrationStatus === 'loading' ? 'Processing...' : 'Run Maintenance Script'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 px-1 mt-8">{t('profile.tiers')}</h3>
                <RoadmapBlock />
            </div>
        </div>
  );
};
