import React from 'react';
import { RoadmapPost } from '../../types';
import { TypeBadge } from './RoadmapBadge';
import { VoteButton } from './VoteButton';

interface RoadmapCardProps {
  post: RoadmapPost;
  currentUserId?: string;
  onVote: (postId: string) => void;
  onClick: (post: RoadmapPost) => void;
}

export const RoadmapCard: React.FC<RoadmapCardProps> = ({ post, currentUserId, onVote, onClick }) => {
  const hasVoted = currentUserId ? post.voterIds.includes(currentUserId) : false;

  return (
    <div 
      onClick={() => onClick(post)}
      className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col gap-3"
    >
      <h4 className="font-semibold text-zinc-900 leading-snug">{post.title}</h4>
      
      <p className="text-sm text-zinc-500 line-clamp-3 leading-relaxed">
        {post.description}
      </p>
      
      <div className="flex items-center justify-between mt-2 pt-3 border-t border-zinc-100">
        <TypeBadge type={post.type} />
        
        <VoteButton 
          votes={post.voterIds.length} 
          hasVoted={hasVoted} 
          onVote={(e) => {
            e.stopPropagation();
            onVote(post.id);
          }} 
        />
      </div>
    </div>
  );
};
