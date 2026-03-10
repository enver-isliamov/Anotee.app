import React from 'react';
import { ChevronUp } from 'lucide-react';

interface VoteButtonProps {
  votes: number;
  hasVoted: boolean;
  onVote: (e: React.MouseEvent) => void;
  className?: string;
}

export const VoteButton: React.FC<VoteButtonProps> = ({ votes, hasVoted, onVote, className = '' }) => {
  return (
    <button
      onClick={onVote}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
        hasVoted 
          ? 'bg-zinc-900 text-white border-zinc-900 hover:bg-zinc-800' 
          : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
      } ${className}`}
    >
      <ChevronUp size={16} className={hasVoted ? 'text-white' : 'text-zinc-400'} />
      <span>{votes}</span>
    </button>
  );
};
