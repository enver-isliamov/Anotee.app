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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
          <Bug size={14} />
          Bug
        </span>
      );
    case 'feature':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
          <PlusCircle size={14} />
          Feature
        </span>
      );
    case 'improvement':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100">
          <CircleDashed size={14} />
          Under Review
        </span>
      );
    case 'planned':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-100">
          <Clock size={14} />
          Planned
        </span>
      );
    case 'in_progress':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
          <PlayCircle size={14} />
          In Progress
        </span>
      );
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
          <CheckCircle2 size={14} />
          Completed
        </span>
      );
    case 'closed':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
          <XCircle size={14} />
          Closed
        </span>
      );
    default:
      return null;
  }
};
