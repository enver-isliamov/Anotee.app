import React, { useState } from 'react';
import { useRoadmap } from '../../hooks/useRoadmap';
import { RoadmapBoard } from './RoadmapBoard';
import { RoadmapList } from './RoadmapList';
import { SubmitPostModal } from './SubmitPostModal';
import { PostDetailModal } from './PostDetailModal';
import { RoadmapPost, User } from '../../types';
import { PlusCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../../services/i18n';

interface RoadmapPageProps {
  currentUser: User | null;
  onLoginRequest: () => void;
}

export const RoadmapPage: React.FC<RoadmapPageProps> = ({ currentUser, onLoginRequest }) => {
  const { posts, isLoading, createPost, toggleVote, addComment, updatePostStatus } = useRoadmap(currentUser?.id);
  const [viewMode, setViewMode] = useState<'issues' | 'roadmap'>('roadmap');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<RoadmapPost | null>(null);
  const { t } = useLanguage();

  const handleVote = async (postId: string) => {
    if (!currentUser) {
      onLoginRequest();
      return;
    }
    await toggleVote(postId);
  };

  const handleSubmitPost = async (data: any) => {
    await createPost(data);
  };

  const handleAddComment = async (postId: string, content: string) => {
    if (!currentUser) return;
    await addComment(postId, content, currentUser.name, currentUser.avatar);
  };

  const handleUpdateStatus = async (postId: string, status: any) => {
    await updatePostStatus(postId, status);
  };

  return (
    <div className="w-full py-4 md:py-8">
      <div className="w-full max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800/50 text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-6">
            {t('roadmap.badge.propose')}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 dark:text-white tracking-tight mb-4">
            {t('roadmap.title')}
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-8">
            {t('roadmap.subtitle')}
          </p>
          <button 
            onClick={() => setIsSubmitModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-sm hover:shadow-md"
          >
            <PlusCircle size={18} />
            {t('roadmap.submit_btn')}
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex justify-start mb-8">
          <div className="inline-flex bg-zinc-100/80 dark:bg-zinc-800/50 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 backdrop-blur-sm">
            <button
              onClick={() => setViewMode('issues')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'issues' 
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-600/50' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
              }`}
            >
              {t('roadmap.tab.issues')}
            </button>
            <button
              onClick={() => setViewMode('roadmap')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'roadmap' 
                  ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-600/50' 
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
              }`}
            >
              {t('roadmap.tab.roadmap')}
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin text-zinc-400" size={32} />
          </div>
        ) : (
          <div className="animate-in fade-in duration-500">
            {viewMode === 'roadmap' ? (
              <RoadmapBoard 
                posts={posts} 
                currentUserId={currentUser?.id} 
                onVote={handleVote}
                onPostClick={setSelectedPost}
              />
            ) : (
              <RoadmapList 
                posts={posts} 
                currentUserId={currentUser?.id} 
                onVote={handleVote}
                onPostClick={setSelectedPost}
              />
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <SubmitPostModal 
        isOpen={isSubmitModalOpen} 
        onClose={() => setIsSubmitModalOpen(false)} 
        onSubmit={handleSubmitPost}
        isLoggedIn={!!currentUser}
        onLoginRequest={() => {
          setIsSubmitModalOpen(false);
          onLoginRequest();
        }}
      />

      <PostDetailModal 
        post={selectedPost} 
        isOpen={!!selectedPost} 
        onClose={() => setSelectedPost(null)} 
        currentUserId={currentUser?.id}
        onVote={handleVote}
        onAddComment={handleAddComment}
        isAdmin={currentUser?.isAdmin}
        onUpdateStatus={handleUpdateStatus}
        onLoginRequest={() => {
          setSelectedPost(null);
          onLoginRequest();
        }}
      />
    </div>
  );
};
