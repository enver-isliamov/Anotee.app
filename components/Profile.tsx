
import React, { useEffect, useState } from 'react';
import { User, UserRole } from '../types';
import { LogOut, ShieldCheck, Mail, Crown, HardDrive, CheckCircle, RefreshCw, AlertTriangle, Link as LinkIcon, XCircle } from 'lucide-react';
import { RoadmapBlock } from './RoadmapBlock';
import { useLanguage } from '../services/i18n';
import { useUser, useAuth } from '@clerk/clerk-react';

interface ProfileProps {
  currentUser: User;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ currentUser, onLogout }) => {
  const isFounder = currentUser.role === UserRole.ADMIN;
  const isGuest = currentUser.role === UserRole.GUEST;
  const { t } = useLanguage();
  const { user } = useUser();
  const { getToken } = useAuth();
  
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  
  // Frontend scope check
  const [hasScope, setHasScope] = useState(false);
  // Backend token check
  const [backendHasToken, setBackendHasToken] = useState<boolean | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Check Frontend Scopes
  useEffect(() => {
      if (!user) {
          setHasScope(false);
          return;
      }
      const googleAccount = user.externalAccounts.find(
          a => a.provider === 'google' || a.verification?.strategy === 'oauth_google'
      );
      if (!googleAccount) {
          setHasScope(false);
          return;
      }
      const scopes = googleAccount.approvedScopes || "";
      setHasScope(scopes.includes(DRIVE_SCOPE));
  }, [user]);

  // 2. Check Backend Token Availability (The real truth)
  useEffect(() => {
      const checkBackend = async () => {
          if (!user || isGuest) return;
          try {
              const token = await getToken();
              const res = await fetch('/api/driveToken', {
                  headers: { 'Authorization': `Bearer ${token}` }
              });
              if (res.ok) {
                  setBackendHasToken(true);
              } else {
                  console.warn("Profile: Backend missing Drive token despite frontend status");
                  setBackendHasToken(false);
              }
          } catch (e) {
              console.error("Profile: Failed to check backend status", e);
              setBackendHasToken(false);
          }
      };
      
      if (hasScope) {
          checkBackend();
      } else {
          setBackendHasToken(false);
      }
  }, [user, hasScope, isGuest, getToken]);

  const handleConnectDrive = async () => {
      if (!user) return;
      setIsProcessing(true);
      
      try {
          const googleAccount = user.externalAccounts.find(
             a => a.provider === 'google' || a.verification?.strategy === 'oauth_google'
          );

          if (googleAccount) {
              // FORCE Re-Authorization
              await googleAccount.reauthorize({
                  additionalScopes: [DRIVE_SCOPE],
                  redirectUrl: window.location.href
              });
              // After reauth, re-check backend
              setBackendHasToken(null); // Reset to loading state
          } else {
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

  const renderDriveStatus = () => {
      if (isGuest) {
          return (
            <button 
                onClick={handleConnectDrive}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors w-full md:w-auto justify-center bg-indigo-600 text-white hover:bg-indigo-500"
            >
                <HardDrive size={14} /> Link Google Account
            </button>
          );
      }

      if (isProcessing) {
          return (
            <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <RefreshCw size={14} className="animate-spin"/> Processing...
            </div>
          );
      }

      // Case A: Everything Good
      if (hasScope && backendHasToken === true) {
          return (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500 text-xs font-bold bg-green-100 dark:bg-green-900/20 px-3 py-1.5 rounded-full border border-green-200 dark:border-green-500/20 whitespace-nowrap">
                    <CheckCircle size={12} /> Active
                </div>
                <button 
                    onClick={handleConnectDrive}
                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline"
                >
                    Reconnect
                </button>
            </div>
          );
      }

      // Case B: Frontend says yes, Backend says no (Ghost Token)
      if (hasScope && backendHasToken === false) {
          return (
            <div className="flex flex-col md:flex-row gap-2 items-center">
                <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs font-bold bg-red-100 dark:bg-red-900/20 px-3 py-1.5 rounded-full border border-red-200 dark:border-red-500/20 whitespace-nowrap">
                    <XCircle size={12} /> Sync Error
                </div>
                <button 
                    onClick={handleConnectDrive}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-red-300 dark:border-red-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-sm"
                >
                    <RefreshCw size={14} /> Repair Connection
                </button>
            </div>
          );
      }

      // Case C: No Scope
      return (
        <button 
            onClick={handleConnectDrive}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors w-full md:w-auto justify-center bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700"
        >
            <AlertTriangle size={14} className="text-orange-500"/> Grant Permissions
        </button>
      );
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
                                {backendHasToken === true 
                                    ? 'Connected to "SmoTree.App" folder' 
                                    : (isGuest ? 'Link account to enable Cloud Storage' : 'Grant permissions to enable uploads')}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {renderDriveStatus()}
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
