import React from 'react';
import { User, UserRole } from '../types';
import { LogOut, Crown, User as UserIcon } from 'lucide-react';
import { RoadmapBlock } from './RoadmapBlock';
import { useLanguage } from '../services/i18n';
import { UserProfile, useClerk } from '@clerk/clerk-react';

interface ProfileProps {
  currentUser: User;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ currentUser, onLogout }) => {
  const isGuest = currentUser.role === UserRole.GUEST;
  const { t } = useLanguage();
  const { openUserProfile } = useClerk();

  // If Guest, show simple card since they don't have a Clerk profile
  if (isGuest) {
      return (
        <div className="max-w-4xl mx-auto space-y-8 py-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('profile.title')}</h2>
                 <button onClick={onLogout} className="text-zinc-500 hover:text-red-400 flex items-center gap-2 text-sm px-4 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-medium">
                    <LogOut size={16} />
                    <span>{t('logout')}</span>
                </button>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 flex flex-col items-center text-center shadow-sm">
                <div className="w-24 h-24 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                    <UserIcon size={40} className="text-zinc-400" />
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">
                    {currentUser.name}
                </h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 text-sm font-medium mb-6">
                    Guest Account
                </div>
                <div className="max-w-md bg-zinc-50 dark:bg-zinc-950/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-400">
                    <p className="mb-2 font-bold text-zinc-900 dark:text-white">{t('profile.migrate_title')}</p>
                    <p className="mb-4">{t('profile.migrate_desc')}</p>
                    <button onClick={onLogout} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold transition-colors w-full">
                        {t('profile.migrate_btn')}
                    </button>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 px-1">{t('profile.tiers')}</h3>
                <RoadmapBlock />
            </div>
        </div>
      );
  }

  // Authenticated User: Use Clerk's Native UserProfile
  return (
        <div className="max-w-5xl mx-auto space-y-8 py-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-4">
                 <h2 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    {t('profile.title')}
                    {currentUser.role === UserRole.ADMIN && <Crown size={20} className="text-yellow-500" fill="currentColor" />}
                 </h2>
            </div>
            
            {/* Clerk User Profile Component */}
            <div className="flex justify-center">
                <UserProfile 
                    routing="hash"
                    appearance={{
                        elements: {
                            rootBox: "w-full shadow-none",
                            card: "w-full shadow-none border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl",
                            navbar: "hidden", // Hide left sidebar for cleaner look if desired, or keep it
                            headerTitle: "text-zinc-900 dark:text-white",
                            headerSubtitle: "text-zinc-500 dark:text-zinc-400",
                            profileSectionTitleText: "text-zinc-900 dark:text-white font-bold",
                            userPreviewMainIdentifier: "text-zinc-900 dark:text-white font-bold",
                            userPreviewSecondaryIdentifier: "text-zinc-500 dark:text-zinc-400",
                            socialButtonsBlockButton: "text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800",
                        },
                        variables: {
                            colorBackground: "transparent",
                            colorText: "inherit",
                        }
                    }}
                />
            </div>

            <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 px-1 mt-8">{t('profile.tiers')}</h3>
                <RoadmapBlock />
            </div>
        </div>
  );
};