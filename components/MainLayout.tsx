
import React from 'react';
import { AppHeader } from './AppHeader';
import { User } from '../types';

interface MainLayoutProps {
  children: React.ReactNode;
  currentUser: User | null;
  currentView: string;
  onNavigate: (page: string) => void;
  onBack: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, currentUser, currentView, onNavigate, onBack }) => {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col transition-colors duration-300">
      <AppHeader 
        currentUser={currentUser} 
        currentView={currentView} 
        onNavigate={onNavigate}
        onBack={onBack}
      />
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
         <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
            {children}
         </div>
      </div>
    </div>
  );
};
