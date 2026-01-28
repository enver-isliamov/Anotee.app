import React, { useEffect, useState } from 'react';
import { User, UserRole } from '../types';
import { LogOut, ShieldCheck, Mail, Crown, AlertCircle, HardDrive, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { RoadmapBlock } from './RoadmapBlock';
import { useLanguage } from '../services/i18n';
import { GoogleDriveService } from '../services/googleDrive';
import { useUser } from '@clerk/clerk-react';

interface ProfileProps {
  currentUser: User;
  onLogout: () => void;
  onMigrate?: (googleCredential: string) => void;
}

declare global {
  interface Window {
    google: any;
  }
}

export const Profile: React.FC<ProfileProps> = ({ currentUser, onLogout, onMigrate }) => {
  const isFounder = currentUser.role === UserRole.ADMIN;
  const isGuest = currentUser.role === UserRole.GUEST;
  const { t } = useLanguage();
  const { user } = useUser();
  
  // 1. Find the Google Account among external accounts
  // Clerk usually uses 'google' as provider, but we check strategy too to be safe.
  const googleAccount = user?.externalAccounts.find(
      a => a.provider === 'google' || a.verification?.strategy === 'oauth_google'
  );

  // 2. Check for the specific scope required for file uploads
  // approvedScopes is a space-separated string
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const hasDriveScope = googleAccount?.approvedScopes?.split(' ').includes(DRIVE_SCOPE);
  
  const [isDriveConnected, setIsDriveConnected] = useState(false);

  useEffect(() => {
      // Sync local state with Clerk data
      setIsDriveConnected(!!hasDriveScope);
  }, [hasDriveScope]);

  // Get Client ID from Environment Variables (Vite)
  const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || "";

  useEffect(() => {
    if (isGuest && GOOGLE_CLIENT_ID && window.google && onMigrate) {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: any) => {
              onMigrate(response.credential);
          },
          auto_select: false,
          theme: "filled_black"
        });
        
        const btnContainer = document.getElementById("googleMigrationDiv");
        if (btnContainer) {
            window.google.accounts.id.renderButton(
              btnContainer,
              { theme: "outline", size: "large", width: "100%", text: "continue_with" } 
            );
        }
      } catch (e) {
        console.error("Google Auth Init Error in Profile", e);
      }
    }
  }, [isGuest, GOOGLE_CLIENT_ID, onMigrate]);

  // Init Drive Service on mount (idempotent)
  useEffect(() => {
     if (GOOGLE_CLIENT_ID) {
         GoogleDriveService.init(GOOGLE_CLIENT_ID);
     }
  }, [GOOGLE_CLIENT_ID]);

  const handleConnectDrive = async () => {
      if (!user) return;
      
      try {
          if (googleAccount) {
              // Re-authorize to add the missing scope OR refresh the token
              await googleAccount.reauthorize({
                  additionalScopes: [DRIVE_SCOPE],
                  redirectUrl: window.location.href
              });
          } else {
              // Connect new Google account with the scope
              await user.createExternalAccount({
                  strategy: 'oauth_google',
                  redirectUrl: window.location.href,
                  additionalScopes: [DRIVE_SCOPE]
              });
          }
      } catch (e) {
          console.error("Failed to authorize Drive scope", e);
          alert("Failed to connect Google Drive. Please try again.");
      }
  };

  const handleDisconnectDrive = () => {
      alert("To fully disconnect, please revoke access in your Google Account security settings, or sign out and sign in again without checking the Drive box.");
  };

  return (
        <div className="max-w-4xl mx-auto space-y-8 py-8">
            
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-white">{t('profile.title')}</h2>
                 <button onClick={onLogout} className="text-zinc-500 hover:text-red-400 flex items-center gap-2 text-sm px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors bg-zinc-900 border border-zinc-800 font-medium">
                    <LogOut size={16} />
                    <span>{t('logout')}</span>
                </button>
            </div>
            
            {/* Profile Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row items-center md:items-start gap-6 shadow-sm relative overflow-hidden">
                <img 
                    src={currentUser.avatar} 
                    alt={currentUser.name} 
                    className="w-24 h-24 rounded-full border-4 border-zinc-950 shadow-lg object-cover"
                />
                <div className="flex-1 text-center md:text-left w-full">
                    <h2 className="text-2xl font-bold text-white mb-2 flex items-center justify-center md:justify-start gap-2">
                        {currentUser.name}
                        {isFounder && <Crown size={20} className="text-yellow-500" fill="currentColor" />}
                    </h2>
                    <div className="flex flex-col md:flex-row items-center md:justify-start gap-3 text-sm text-zinc-400 mb-5">
                        <span className="flex items-center gap-1.5 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800/50">
                            <Mail size={14} /> {currentUser.id.includes('@') ? currentUser.id : 'No email'}
                        </span>
                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${isFounder ? 'bg-indigo-900/20 text-indigo-400 border-indigo-500/20' : 'bg-zinc-800 border-zinc-700'}`}>
                            <ShieldCheck size={14} /> {currentUser.role}
                        </span>
                    </div>
                    
                    {isFounder && (
                        <p className="text-sm text-green-400 bg-green-900/10 border border-green-900/20 p-3 rounded-lg inline-block">
                            {t('profile.founder_msg')}
                        </p>
                    )}
                </div>
            </div>

            {/* STORAGE CONNECTIONS */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <HardDrive size={18} className="text-indigo-400" /> Connected Storage
                </h3>
                <div className="bg-black/40 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between border border-zinc-800 gap-4">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0">
                            {/* Google Drive Logo SVG */}
                            <svg className="w-6 h-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75 23.8 13.751 23.8 9.55-16.55 3.85-6.65c.8-1.4 1.2-2.95 1.2-4.5h-55.852z" fill="#ffba00"/></svg>
                        </div>
                        <div>
                            <div className="text-sm font-bold text-zinc-200">Google Drive</div>
                            <div className="text-xs text-zinc-500">
                                {isDriveConnected 
                                    ? 'Connected to "SmoTree.App" folder' 
                                    : 'Connect to use your own cloud storage'}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {isDriveConnected ? (
                            <>
                                <div className="flex items-center gap-1.5 text-green-500 text-xs font-bold bg-green-900/20 px-3 py-1.5 rounded-full border border-green-500/20 whitespace-nowrap">
                                    <CheckCircle size={12} /> Linked
                                </div>
                                <button 
                                    onClick={handleConnectDrive}
                                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold transition-colors border border-zinc-700 flex items-center gap-2 whitespace-nowrap"
                                >
                                    <RefreshCw size={14} /> Reconnect
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={handleConnectDrive}
                                className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg text-xs font-bold hover:bg-zinc-200 transition-colors w-full md:w-auto justify-center"
                            >
                                <HardDrive size={14} /> Connect Drive
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* MIGRATION BLOCK FOR GUESTS */}
            {isGuest && (
                <div className="bg-gradient-to-r from-orange-900/10 to-red-900/10 border border-orange-500/20 rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-50">
                        <AlertCircle size={64} className="text-orange-500/10" />
                    </div>
                    
                    <div className="relative z-10">
                        <h3 className="text-xl font-bold text-white mb-2">{t('profile.migrate_title')}</h3>
                        <p className="text-zinc-400 mb-6 max-w-xl text-sm leading-relaxed">
                            {t('profile.migrate_desc')}
                        </p>
                        
                        <div className="max-w-xs">
                            {!GOOGLE_CLIENT_ID ? (
                                <div className="text-red-400 text-xs">Google Client ID missing in config.</div>
                            ) : (
                                <div id="googleMigrationDiv" className="h-[44px] w-full min-h-[44px]"></div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Roadmap Info for User */}
            <div>
                <h3 className="text-lg font-bold text-white mb-4 px-1">{t('profile.tiers')}</h3>
                <RoadmapBlock />
            </div>

        </div>
  );
};
