import React, { useState, useMemo } from 'react';
import { RoadmapPost, RoadmapPostStatus, RoadmapPostType } from '../../types';
import { StatusBadge, TypeBadge } from './RoadmapBadge';
import { VoteButton } from './VoteButton';
import { Search, Filter } from 'lucide-react';

interface RoadmapListProps {
  posts: RoadmapPost[];
  currentUserId?: string;
  onVote: (postId: string) => void;
  onPostClick: (post: RoadmapPost) => void;
}

export const RoadmapList: React.FC<RoadmapListProps> = ({ posts, currentUserId, onVote, onPostClick }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RoadmapPostStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<RoadmapPostType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'votes'>('votes');

  const filteredPosts = useMemo(() => {
    return posts
      .filter(post => {
        const matchesSearch = post.title.toLowerCase().includes(search.toLowerCase()) || 
                              post.description.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
        const matchesType = typeFilter === 'all' || post.type === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        if (sortBy === 'votes') {
          return b.voterIds.length - a.voterIds.length;
        } else {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });
  }, [posts, search, statusFilter, typeFilter, sortBy]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Search issues..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <select 
            value={typeFilter} 
            onChange={e => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">All Types</option>
            <option value="feature">Features</option>
            <option value="bug">Bugs</option>
            <option value="improvement">Improvements</option>
          </select>
          
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">All Statuses</option>
            <option value="under_review">Under Review</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
          </select>
          
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="votes">Most Voted</option>
            <option value="recent">Recently Created</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200 border-dashed">
            <p className="text-zinc-500">No issues found matching your filters.</p>
          </div>
        ) : (
          filteredPosts.map(post => {
            const hasVoted = currentUserId ? post.voterIds.includes(currentUserId) : false;
            
            return (
              <div 
                key={post.id}
                onClick={() => onPostClick(post)}
                className="group flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-5 bg-white rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <StatusBadge status={post.status} />
                    <TypeBadge type={post.type} />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 mb-1 group-hover:text-indigo-600 transition-colors">{post.title}</h3>
                  <p className="text-sm text-zinc-500 line-clamp-2">{post.description}</p>
                </div>
                
                <div className="flex items-center shrink-0">
                  <VoteButton 
                    votes={post.voterIds.length} 
                    hasVoted={hasVoted} 
                    onVote={(e) => {
                      e.stopPropagation();
                      onVote(post.id);
                    }} 
                    className="scale-110"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
