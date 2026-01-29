
import React, { useEffect, useState } from 'react';
import { User, UserRole } from '../types';
import { LogOut, ShieldCheck, Mail, Crown, HardDrive, CheckCircle, RefreshCw, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { RoadmapBlock } from './RoadmapBlock';
import { useLanguage } from '../services/i18n';
import { useUser } from '@clerk/clerk-react';

interface ProfileProps {
  currentUser: User;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ currentUser, onLogout }) => {
  const isFounder = currentUser.role === UserRole.ADMIN;
  const isGuest = currentUser.role === UserRole.GUEST;
  const { t } = useLanguage();
  const { user } = useUser();
  
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
      if (!user) {
          setIsDriveConnected(false);
          return;
      }
      
      // Find the Google account connection
      const googleAccount = user.externalAccounts.find(
          a => a.provider === 'google' || a.verification?.strategy === 'oauth_google'
      );

      if (!googleAccount) {
          setIsDriveConnected(false);
          return;
      }

      // Debugging Scopes: Check console to see what permissions we actually have
      const scopes = googleAccount.approvedScopes || "";
      console.log("🔍 Current Google Scopes:", scopes);

      const hasScope = scopes.includes(DRIVE_SCOPE);
      setIsDriveConnected(hasScope);
  }, [user]);

  const handleConnectDrive = async () => {
      if (!user) return;
      setIsProcessing(true);
      
      try {
          const googleAccount = user.externalAccounts.find(
             a => a.provider === 'google' || a.verification?.strategy === 'oauth_google'
          );

          if (googleAccount) {
              // FORCE Re-Authorization to ensure we get the Scope and a fresh Refresh Token
              // We pass 'force' to ensure the consent screen appears if needed
              await googleAccount.reauthorize({
                  additionalScopes: [DRIVE_SCOPE],
                  redirectUrl: window.location.href
              });
          } else {
              // Create new connection if none exists
              await user.createExternalAccount({
                  strategy: 'oauth_google',
                  redirectUrl: window.location.href,
                  additionalScopes: [DRIVE_SCOPE]
              });
          }
      } catch (e) {
          console.error("Failed to authorize Drive scope", e);
          alert("Failed to connect Google Drive. Please check popup blocker.");
      } finally {
          setIsProcessing(false);
      }
  };

  return (
        <div className="max-w-4xl mx-auto space-y-8 py-8">
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{t('profile.title')}</h2>
                 <button onClick={onLogout} className="text-zinc-500 hover:text-red-400 flex items-center gap-2 text-sm px-4 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-medium">
                    <LogOut size={16} />
                    <span>{t('logout')}</span>
                </button>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row items-center md:items-start gap-6 shadow-sm relative overflow-hidden">
                <img 
                    src={currentUser.avatar} 
                    alt={currentUser.name} 
                    className="w-24 h-24 rounded-full border-4 border-white dark:border-zinc-950 shadow-lg object-cover"
                />
                <div className="flex-1 text-center md:text-left w-full">
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2 flex items-center justify-center md:justify-start gap-2">
                        {currentUser.name}
                        {isFounder && <Crown size={20} className="text-yellow-500" fill="currentColor" />}
                    </h2>
                    <div className="flex flex-col md:flex-row items-center md:justify-start gap-3 text-sm text-zinc-500 dark:text-zinc-400 mb-5">
                        <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                            <Mail size={14} /> {currentUser.id.includes('@') ? currentUser.id : 'No email'}
                        </span>
                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${isFounder ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'}`}>
                            <ShieldCheck size={14} /> {currentUser.role}
                        </span>
                    </div>
                    {isFounder && (
                        <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/20 p-3 rounded-lg inline-block">
                            {t('profile.founder_msg')}
                        </p>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
                    <HardDrive size={18} className="text-indigo-600 dark:text-indigo-400" /> Connected Storage
                </h3>
                
                <div className="bg-zinc-50 dark:bg-black/40 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between border border-zinc-200 dark:border-zinc-800 gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-200 dark:border-transparent shadow-sm">
                            <svg className="w-6 h-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75 23.8 13.751 23.8 9.55-16.55 3.85-6.65c.8-1.4 1.2-2.95 1.2-4.5h-55.852z" fill="#ffba00"/></svg>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-zinc-900 dark:text-zinc-200">Google Drive</div>
                            <div className="text-xs text-zinc-500">
                                {isDriveConnected 
                                    ? 'Connected to "SmoTree.App" folder' 
                                    : (isGuest ? 'Link account to enable Cloud Storage' : 'Grant permissions to enable uploads')}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {isDriveConnected ? (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500 text-xs font-bold bg-green-100 dark:bg-green-900/20 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-500/20 whitespace-nowrap">
                                    <CheckCircle size={12} /> Active
                                </div>
                                {/* NEW: Reconnect button even if active, to fix broken tokens */}
                                <button 
                                    onClick={handleConnectDrive}
                                    disabled={isProcessing}
                                    className="text-xs text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                    title="Reconnect Drive if you are experiencing issues"
                                >
                                    <RefreshCw size={12} className={isProcessing ? "animate-spin" : ""} />
                                    {isProcessing ? 'Fixing...' : 'Reconnect'}
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={handleConnectDrive}
                                disabled={isProcessing}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors w-full md:w-auto justify-center ${isGuest ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}
                            >
                                {isProcessing ? <RefreshCw size={14} className="animate-spin"/> : (isGuest ? <HardDrive size={14} /> : <AlertTriangle size={14} className="text-orange-500"/>)}
                                {isGuest ? 'Link Google Account' : 'Grant Permissions'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 px-1">{t('profile.tiers')}</h3>
                <RoadmapBlock />
            </div>
        </div>
  );
};
