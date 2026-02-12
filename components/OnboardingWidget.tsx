
import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { X, ArrowRight, MousePointer2, Check, ArrowLeft } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface TourGuideProps {
    targetId: string;
    title: string;
    description: string;
    onDismiss: () => void;
    onNext?: () => void;
    onPrev?: () => void;
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
    onPrev,
    currentStep = 1,
    totalSteps = 1,
    position = 'bottom'
}) => {
    const [coords, setCoords] = useState<{ top: number, left: number, width: number, height: number } | null>(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [adjustedPos, setAdjustedPos] = useState<React.CSSProperties>({});

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useLayoutEffect(() => {
        const updatePosition = () => {
            const el = document.getElementById(targetId);
            if (el) {
                const rect = el.getBoundingClientRect();
                
                // Scroll if needed
                const isInViewport = (
                    rect.top >= 0 &&
                    rect.left >= 0 &&
                    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
                );

                if (!isInViewport) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }

                setCoords({
                    top: rect.top + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width,
                    height: rect.height
                });
            }
        };

        const timer = setTimeout(updatePosition, 300);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition);
        };
    }, [targetId]);

    // Calculate smart position to avoid overflow
    useLayoutEffect(() => {
        if (!coords || isMobile) return;

        const CARD_WIDTH = 320;
        const OFFSET = 16;
        const screenW = window.innerWidth;
        
        let style: React.CSSProperties = { position: 'absolute', width: CARD_WIDTH, zIndex: 10001 };
        
        // Default: Center horizontally relative to target
        let leftPos = coords.left + (coords.width / 2) - (CARD_WIDTH / 2);
        let topPos = coords.top + coords.height + OFFSET; // Default bottom

        // 1. Check Horizontal Overflow
        if (leftPos + CARD_WIDTH > screenW - 20) {
            // If goes off right screen -> align to right edge of target or screen
            leftPos = (coords.left + coords.width) - CARD_WIDTH;
            if (leftPos + CARD_WIDTH > screenW - 20) leftPos = screenW - CARD_WIDTH - 20;
        }
        if (leftPos < 20) leftPos = 20;

        // 2. Check Vertical Preference (based on props or space)
        if (position === 'top') {
            topPos = coords.top - OFFSET;
            style.transform = 'translateY(-100%)';
        } else if (position === 'left') {
             leftPos = coords.left - CARD_WIDTH - OFFSET;
             topPos = coords.top;
        } else if (position === 'right') {
             leftPos = coords.left + coords.width + OFFSET;
             topPos = coords.top;
        }

        style.left = leftPos;
        style.top = topPos;

        setAdjustedPos(style);

    }, [coords, isMobile, position]);

    if (!coords) return null;

    const mobileStyle: React.CSSProperties = {
        position: 'fixed',
        bottom: '24px',
        left: '16px',
        right: '16px',
        width: 'auto',
        zIndex: 10001,
    };

    const isLastStep = currentStep === totalSteps;

    return createPortal(
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden touch-none">
            
            {/* Spotlight Overlay */}
            <div 
                className="absolute rounded-lg transition-all duration-500 ease-in-out"
                style={{
                    top: coords.top - 4,
                    left: coords.left - 4,
                    width: coords.width + 8,
                    height: coords.height + 8,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)', 
                    zIndex: 10000 
                }}
            >
                <div className="absolute inset-0 border-2 border-indigo-500 rounded-lg animate-pulse"></div>
            </div>

            {/* Tooltip Card */}
            <div 
                ref={tooltipRef}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-2xl pointer-events-auto flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-300"
                style={isMobile ? mobileStyle : adjustedPos}
            >
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                            <MousePointer2 size={16} />
                        </div>
                        {totalSteps > 1 && (
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                Шаг {currentStep} / {totalSteps}
                            </span>
                        )}
                    </div>
                    <button onClick={onDismiss} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1">
                        <X size={16} />
                    </button>
                </div>

                <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-base mb-1.5">{title}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {description}
                    </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800/50 mt-1">
                    {onPrev && currentStep > 1 ? (
                         <button onClick={onPrev} className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 px-2 py-1.5 rounded transition-colors flex items-center gap-1">
                            <ArrowLeft size={12} /> Назад
                        </button>
                    ) : <div></div>}

                    {onNext && !isLastStep ? (
                        <button onClick={onNext} className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20">
                            Далее <ArrowRight size={14} />
                        </button>
                    ) : (
                        <button onClick={onDismiss} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
                            {isLastStep ? 'Завершить' : 'Понятно'} <Check size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
