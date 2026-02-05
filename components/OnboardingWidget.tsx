
import React, { useEffect, useState, useRef } from 'react';
import { X, ArrowRight, MousePointer2, Check } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface TourGuideProps {
    targetId: string;
    title: string;
    description: string;
    onDismiss: () => void;
    onNext?: () => void;
    currentStep?: number;
    totalSteps?: number;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export const OnboardingWidget: React.FC<TourGuideProps> = ({ 
    targetId, 
    title, 
    description, 
    onDismiss,
    onNext,
    currentStep = 1,
    totalSteps = 1,
    position = 'bottom'
}) => {
    const [coords, setCoords] = useState<{ top: number, left: number, width: number, height: number } | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const updatePosition = () => {
            const el = document.getElementById(targetId);
            if (el) {
                const rect = el.getBoundingClientRect();
                // Ensure element is actually visible in viewport, otherwise scroll to it
                if (rect.top < 0 || rect.bottom > window.innerHeight) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                setCoords({
                    top: rect.top + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width,
                    height: rect.height
                });
                setIsVisible(true);
            } else {
                // If target not found, try again shortly (modal animations etc)
                setIsVisible(false);
            }
        };

        // Initial check with delay for layout stability
        const timer = setTimeout(updatePosition, 300);
        
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition);
        };
    }, [targetId]);

    if (!isVisible || !coords) return null;

    let tooltipStyle: React.CSSProperties = {};
    const OFFSET = 12;

    // Simple positioning logic
    switch (position) {
        case 'bottom':
            tooltipStyle = { top: coords.top + coords.height + OFFSET, left: coords.left + (coords.width / 2) - 140 };
            break;
        case 'top':
            tooltipStyle = { top: coords.top - OFFSET, left: coords.left + (coords.width / 2) - 140, transform: 'translateY(-100%)' };
            break;
    }

    // Boundary check (keep on screen)
    if (tooltipStyle.left && (tooltipStyle.left as number) < 10) tooltipStyle.left = 10;
    if (tooltipStyle.left && (tooltipStyle.left as number) > window.innerWidth - 300) tooltipStyle.left = window.innerWidth - 300;

    const isLastStep = currentStep === totalSteps;

    return createPortal(
        <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
            {/* 1. Pulse Highlight */}
            <div 
                className="absolute border-2 border-indigo-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] animate-pulse transition-all duration-300 pointer-events-none"
                style={{
                    top: coords.top - 4,
                    left: coords.left - 4,
                    width: coords.width + 8,
                    height: coords.height + 8,
                }}
            />

            {/* 2. Floating Card */}
            <div 
                className="absolute bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4 rounded-xl shadow-2xl w-[280px] pointer-events-auto animate-in zoom-in-95 fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-3"
                style={tooltipStyle}
            >
                {/* Connector Arrow */}
                {position === 'bottom' && <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-zinc-900 border-t border-l border-zinc-200 dark:border-zinc-700 rotate-45 transform"></div>}
                {position === 'top' && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-zinc-900 border-b border-r border-zinc-200 dark:border-zinc-700 rotate-45 transform"></div>}
                
                <div className="flex justify-between items-start relative z-10">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <MousePointer2 size={16} />
                        </div>
                        {totalSteps > 1 && (
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                Шаг {currentStep} из {totalSteps}
                            </span>
                        )}
                    </div>
                    <button onClick={onDismiss} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                        <X size={16} />
                    </button>
                </div>

                <div className="relative z-10">
                    <h3 className="font-bold text-zinc-900 dark:text-white text-sm mb-1">{title}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {description}
                    </p>
                </div>

                <div className="flex justify-end pt-2 border-t border-zinc-100 dark:border-zinc-800 relative z-10">
                    {onNext && !isLastStep ? (
                        <button onClick={onNext} className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                            Далее <ArrowRight size={12} />
                        </button>
                    ) : (
                        <button onClick={onDismiss} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                            {isLastStep && totalSteps > 1 ? 'Завершить' : 'Понятно'} {isLastStep ? <Check size={12} /> : <ArrowRight size={12} />}
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
