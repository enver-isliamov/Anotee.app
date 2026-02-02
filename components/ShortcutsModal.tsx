
import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';
import { useLanguage } from '../services/i18n';

interface Props {
  onClose: () => void;
}

export const ShortcutsModal: React.FC<Props> = ({ onClose }) => {
  const { t } = useLanguage();

  const sections = [
    {
      title: t('shortcuts.player'),
      items: [
        { keys: ['Space'], desc: t('shortcuts.play') },
        { keys: ['J'], desc: t('shortcuts.rewind') },
        { keys: ['K'], desc: 'Pause' },
        { keys: ['L'], desc: t('shortcuts.forward') },
        { keys: ['←', '→'], desc: t('shortcuts.frame') },
        { keys: ['F'], desc: t('shortcuts.fullscreen') },
      ]
    },
    {
      title: t('shortcuts.markers'),
      items: [
        { keys: ['M'], desc: t('shortcuts.marker') },
        { keys: ['I'], desc: t('shortcuts.in') },
        { keys: ['O'], desc: t('shortcuts.out') },
        { keys: ['Enter'], desc: t('shortcuts.save') },
        { keys: ['Esc'], desc: t('shortcuts.cancel') },
      ]
    },
    {
      title: t('shortcuts.general'),
      items: [
        { keys: ['?'], desc: t('shortcuts.show') },
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div 
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <Keyboard size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{t('shortcuts.title')}</h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('shortcuts.subtitle')}</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 transition-colors">
                <X size={20} />
            </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {sections.map((section, idx) => (
                    <div key={idx}>
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            {section.title}
                        </h3>
                        <div className="space-y-3">
                            {section.items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between group">
                                    <span className="text-sm text-zinc-600 dark:text-zinc-300 font-medium group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">
                                        {item.desc}
                                    </span>
                                    <div className="flex gap-1">
                                        {item.keys.map((k, kIdx) => (
                                            <kbd key={kIdx} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs font-mono text-zinc-600 dark:text-zinc-300 font-bold min-w-[24px] text-center shadow-sm">
                                                {k}
                                            </kbd>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Footer */}
        <div className="bg-zinc-50 dark:bg-zinc-950 px-6 py-3 text-center border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-400">
            {t('shortcuts.tip')}
        </div>
      </div>
    </div>
  );
};
