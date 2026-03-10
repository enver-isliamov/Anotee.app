import React, { useState } from 'react';
import { RoadmapPost, RoadmapPostStatus } from '../../types';
import { X, MessageSquare, Send } from 'lucide-react';
import { StatusBadge, TypeBadge } from './RoadmapBadge';
import { VoteButton } from './VoteButton';

interface PostDetailModalProps {
  post: RoadmapPost | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  onVote: (postId: string) => void;
  onAddComment: (postId: string, content: string) => Promise<void>;
  isAdmin?: boolean;
  onUpdateStatus?: (postId: string, status: RoadmapPostStatus) => Promise<void>;
  onLoginRequest: () => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({ 
  post, isOpen, onClose, currentUserId, onVote, onAddComment, isAdmin, onUpdateStatus, onLoginRequest 
}) => {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !post) return null;

  const hasVoted = currentUserId ? post.voterIds.includes(currentUserId) : false;

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUserId) return;

    setIsSubmitting(true);
    try {
      await onAddComment(post.id, newComment);
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-zinc-100">
          <h2 className="text-xl font-bold text-zinc-900 line-clamp-1 pr-4">{post.title}</h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <p className="text-zinc-700 leading-relaxed whitespace-pre-wrap">{post.description}</p>
            
            <div className="flex items-center gap-3 flex-wrap">
              <VoteButton 
                votes={post.voterIds.length} 
                hasVoted={hasVoted} 
                onVote={() => onVote(post.id)} 
              />
              <TypeBadge type={post.type} />
              
              {isAdmin && onUpdateStatus ? (
                <select 
                  value={post.status}
                  onChange={(e) => onUpdateStatus(post.id, e.target.value as RoadmapPostStatus)}
                  className="px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-full text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="under_review">Under Review</option>
                  <option value="planned">Planned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </select>
              ) : (
                <StatusBadge status={post.status} />
              )}
            </div>
          </div>

          <div className="border-t border-zinc-100 pt-6 flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
              <MessageSquare size={18} className="text-zinc-400" />
              Comments ({post.comments.length})
            </h3>

            {!currentUserId ? (
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 text-center">
                <p className="text-zinc-600 mb-3 text-sm">Please sign in to leave a comment</p>
                <button 
                  onClick={onLoginRequest}
                  className="px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-sm font-medium hover:bg-zinc-50 transition-colors shadow-sm"
                >
                  Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleCommentSubmit} className="flex flex-col gap-3">
                <textarea 
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Comment on this feature..."
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all min-h-[100px] resize-y text-sm"
                  required
                />
                <div className="flex justify-end">
                  <button 
                    type="submit" 
                    disabled={isSubmitting || !newComment.trim()}
                    className="px-5 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
                  >
                    <Send size={14} />
                    {isSubmitting ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-col gap-4 mt-4">
              {post.comments.length === 0 ? (
                <p className="text-center text-zinc-400 text-sm py-4">No comments yet. Be the first to share your thoughts!</p>
              ) : (
                post.comments.map(comment => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                      {comment.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-900">{comment.authorName}</span>
                        <span className="text-xs text-zinc-400">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed bg-zinc-50 p-3 rounded-2xl rounded-tl-none border border-zinc-100">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
