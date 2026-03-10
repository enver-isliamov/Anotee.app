import React, { useState } from 'react';
import { useRoadmap } from '../../hooks/useRoadmap';
import { RoadmapBoard } from './RoadmapBoard';
import { RoadmapList } from './RoadmapList';
import { SubmitPostModal } from './SubmitPostModal';
import { PostDetailModal } from './PostDetailModal';
import { RoadmapPost, User } from '../../types';
import { PlusCircle, Loader2 } from 'lucide-react';

interface RoadmapPageProps {
  currentUser: User | null;
  onLoginRequest: () => void;
}

export const RoadmapPage: React.FC<RoadmapPageProps> = ({ currentUser, onLoginRequest }) => {
  const { posts, isLoading, createPost, toggleVote, addComment, updatePostStatus } = useRoadmap(currentUser?.id);
  const [viewMode, setViewMode] = useState<'issues' | 'roadmap'>('roadmap');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<RoadmapPost | null>(null);

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
    <div className="min-h-screen bg-zinc-50 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 text-sm font-medium text-zinc-600 mb-6">
            Propose a feature, report a bug, or share your ideas
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-zinc-900 tracking-tight mb-4">
            Product Roadmap
          </h1>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto mb-8">
            A place to share your ideas and collaborate on features.
          </p>
          <button 
            onClick={() => setIsSubmitModalOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-all shadow-sm hover:shadow-md"
          >
            <PlusCircle size={18} />
            Submit your Post
          </button>
        </div>

        {/* View Toggle */}
        <div className="flex justify-start mb-8">
          <div className="inline-flex bg-zinc-100/80 p-1 rounded-xl border border-zinc-200/50 backdrop-blur-sm">
            <button
              onClick={() => setViewMode('issues')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'issues' 
                  ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50' 
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'
              }`}
            >
              Issues
            </button>
            <button
              onClick={() => setViewMode('roadmap')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                viewMode === 'roadmap' 
                  ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50' 
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'
              }`}
            >
              Roadmap
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
