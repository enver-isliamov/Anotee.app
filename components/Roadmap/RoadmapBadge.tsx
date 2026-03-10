import React from 'react';
import { RoadmapPostType, RoadmapPostStatus } from '../../types';
import { Bug, PlusCircle, ArrowUpCircle, CircleDashed, Clock, PlayCircle, CheckCircle2, XCircle } from 'lucide-react';

interface TypeBadgeProps {
  type: RoadmapPostType;
}

export const TypeBadge: React.FC<TypeBadgeProps> = ({ type }) => {
  switch (type) {
    case 'bug':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-500/20">
          <Bug size={14} />
          Bug
        </span>
      );
    case 'feature':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20">
          <PlusCircle size={14} />
          Feature
        </span>
      );
    case 'improvement':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
          <ArrowUpCircle size={14} />
          Improvement
        </span>
      );
    default:
      return null;
  }
};

interface StatusBadgeProps {
  status: RoadmapPostStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'under_review':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-100 dark:border-orange-500/20">
          <CircleDashed size={14} />
          Under Review
        </span>
      );
    case 'planned':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-500/20">
          <Clock size={14} />
          Planned
        </span>
      );
    case 'in_progress':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
          <PlayCircle size={14} />
          In Progress
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-100 dark:border-green-500/20">
          <CheckCircle2 size={14} />
          Completed
        </span>
      );
    case 'closed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
          <XCircle size={14} />
          Closed
        </span>
      );
    default:
      return null;
  }
};
