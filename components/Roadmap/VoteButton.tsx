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
          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200' 
          : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'
      } ${className}`}
    >
      <ChevronUp size={16} className={hasVoted ? 'text-white dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500'} />
      <span>{votes}</span>
    </button>
  );
};
