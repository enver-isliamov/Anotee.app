import React, { useState } from 'react';
import { RoadmapPostType } from '../../types';
import { X, Lightbulb, Bug, ArrowUpCircle } from 'lucide-react';
import { useLanguage } from '../../services/i18n';

interface SubmitPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; type: RoadmapPostType }) => Promise<void>;
  isLoggedIn: boolean;
  onLoginRequest: () => void;
}

export const SubmitPostModal: React.FC<SubmitPostModalProps> = ({ isOpen, onClose, onSubmit, isLoggedIn, onLoginRequest }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<RoadmapPostType>('feature');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useLanguage();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({ title, description, type });
      setTitle('');
      setDescription('');
      setType('feature');
      onClose();
    } catch (error) {
      console.error('Failed to submit post', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">{t('roadmap.modal.submit.title')}</h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {!isLoggedIn ? (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-6 text-center">
              <h3 className="text-lg font-semibold text-indigo-900 dark:text-indigo-300 mb-2">Please sign in to submit a post</h3>
              <p className="text-indigo-700 dark:text-indigo-400 mb-6">You must be signed in to submit a post to the community.</p>
              <button 
                onClick={onLoginRequest}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Sign In
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">Fill out the form below to submit your post to the community.</p>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">Type</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setType('feature')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${type === 'feature' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'}`}
                  >
                    <Lightbulb size={20} />
                    <span className="text-xs font-medium">Feature</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('bug')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${type === 'bug' ? 'border-red-500 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'}`}
                  >
                    <Bug size={20} />
                    <span className="text-xs font-medium">Bug</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('improvement')}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${type === 'improvement' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'}`}
                  >
                    <ArrowUpCircle size={20} />
                    <span className="text-xs font-medium">Improvement</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">{t('roadmap.modal.submit.title_label')}</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t('roadmap.modal.submit.title_placeholder')}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-500 transition-all text-zinc-900 dark:text-zinc-100"
                  required
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">A concise title will help others understand your suggestion.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">{t('roadmap.modal.submit.desc_label')}</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t('roadmap.modal.submit.desc_placeholder')}
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-500 transition-all min-h-[120px] resize-y text-zinc-900 dark:text-zinc-100"
                  required
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Provide as much detail as possible to help others understand your suggestion or issue.</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-2">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="px-5 py-2.5 text-zinc-600 dark:text-zinc-400 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  {t('roadmap.modal.submit.cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || !title.trim() || !description.trim()}
                  className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isSubmitting ? 'Submitting...' : t('roadmap.modal.submit.submit')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
