import React from 'react';
import { RoadmapPost, RoadmapPostStatus } from '../../types';
import { RoadmapCard } from './RoadmapCard';
import { StatusBadge } from './RoadmapBadge';

interface RoadmapBoardProps {
  posts: RoadmapPost[];
  currentUserId?: string;
  onVote: (postId: string) => void;
  onPostClick: (post: RoadmapPost) => void;
}

const STATUSES: { value: RoadmapPostStatus; label: string }[] = [
  { value: 'under_review', label: 'Under Review' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' }
];

export const RoadmapBoard: React.FC<RoadmapBoardProps> = ({ posts, currentUserId, onVote, onPostClick }) => {
  return (
    <div className="flex gap-6 overflow-x-auto pb-8 snap-x">
      {STATUSES.map(status => {
        const columnPosts = posts.filter(p => p.status === status.value);
        
        return (
          <div key={status.value} className="flex-shrink-0 w-80 snap-start">
            <div className="flex items-center gap-2 mb-4">
              <StatusBadge status={status.value} />
              <span className="text-sm font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                {columnPosts.length}
              </span>
            </div>
            
            <div className="flex flex-col gap-4 min-h-[200px] bg-zinc-50/50 p-3 rounded-2xl border border-zinc-100">
              {columnPosts.length === 0 ? (
                <div className="text-center py-8 text-zinc-400 text-sm italic">
                  No posts yet
                </div>
              ) : (
                columnPosts.map(post => (
                  <RoadmapCard 
                    key={post.id} 
                    post={post} 
                    currentUserId={currentUserId}
                    onVote={onVote}
                    onClick={onPostClick}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
