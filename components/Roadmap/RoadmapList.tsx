import React, { useState, useMemo } from 'react';
import { RoadmapPost, RoadmapPostStatus, RoadmapPostType } from '../../types';
import { StatusBadge, TypeBadge } from './RoadmapBadge';
import { VoteButton } from './VoteButton';
import { Search, Filter } from 'lucide-react';
import { useLanguage } from '../../services/i18n';

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
  const { t } = useLanguage();

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
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder={t('roadmap.search_placeholder')} 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-500 transition-all text-zinc-900 dark:text-zinc-100"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
          <select 
            value={typeFilter} 
            onChange={e => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">All Types</option>
            <option value="feature">Features</option>
            <option value="bug">Bugs</option>
            <option value="improvement">Improvements</option>
          </select>
          
          <select 
            value={statusFilter} 
            onChange={e => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">{t('roadmap.filter.all')}</option>
            <option value="under_review">{t('roadmap.status.under_review')}</option>
            <option value="planned">{t('roadmap.status.planned')}</option>
            <option value="in_progress">{t('roadmap.status.in_progress')}</option>
            <option value="completed">{t('roadmap.status.completed')}</option>
            <option value="closed">{t('roadmap.status.closed')}</option>
          </select>
          
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="votes">{t('roadmap.sort.popular')}</option>
            <option value="recent">{t('roadmap.sort.newest')}</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 border-dashed">
            <p className="text-zinc-500 dark:text-zinc-400">{t('roadmap.no_posts')}</p>
          </div>
        ) : (
          filteredPosts.map(post => {
            const hasVoted = currentUserId ? post.voterIds.includes(currentUserId) : false;
            
            return (
              <div 
                key={post.id}
                onClick={() => onPostClick(post)}
                className="group flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <StatusBadge status={post.status} />
                    <TypeBadge type={post.type} />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{post.title}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2">{post.description}</p>
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
