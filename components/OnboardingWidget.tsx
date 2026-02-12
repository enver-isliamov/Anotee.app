
import React, { useEffect, useState, useLayoutEffect } from 'react';
import { X, ArrowRight, MousePointer2, Check, ArrowLeft } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface TourGuideProps {
    targetId: string;
    title: string;
    description: string;
    onDismiss: () => void;
    onNext?: () => void;
    onPrev?: () => void; // Added Previous support
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

    // Monitor resize
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Calculate position and scroll
    useLayoutEffect(() => {
        const updatePosition = () => {
            const el = document.getElementById(targetId);
            if (el) {
                const rect = el.getBoundingClientRect();
                
                // Smart Scroll: Only scroll if element is significantly off-screen
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

        // Initial update with small delay to allow DOM/Transitions to settle
        const timer = setTimeout(updatePosition, 350); 
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition);
        };
    }, [targetId]);

    if (!coords) return null;

    // --- POSITIONING LOGIC ---
    let tooltipStyle: React.CSSProperties = {};
    let arrowStyle: React.CSSProperties = {};
    const OFFSET = 16;
    const CARD_WIDTH = 300;

    if (isMobile) {
        // Mobile: Always stick to bottom (Bottom Sheet style)
        tooltipStyle = {
            position: 'fixed',
            bottom: '24px',
            left: '16px',
            right: '16px',
            width: 'auto',
            zIndex: 10001, // Above spotlight
        };
    } else {
        // Desktop: Calculate relative position
        const centerX = coords.left + coords.width / 2;
        const centerY = coords.top + coords.height / 2;

        switch (position) {
            case 'bottom':
                tooltipStyle = { top: coords.top + coords.height + OFFSET, left: centerX - CARD_WIDTH / 2 };
                break;
            case 'top':
                tooltipStyle = { top: coords.top - OFFSET, left: centerX - CARD_WIDTH / 2, transform: 'translateY(-100%)' };
                break;
            case 'left':
                tooltipStyle = { top: centerY, left: coords.left - OFFSET, transform: 'translate(-100%, -50%)' };
                break;
            case 'right':
                tooltipStyle = { top: centerY, left: coords.left + coords.width + OFFSET, transform: 'translateY(-50%)' };
                break;
        }

        // Boundary Checks (Keep on screen)
        // Note: transform logic above complicates direct boundary checks, so we simplify for horizontal
        if (tooltipStyle.left && typeof tooltipStyle.left === 'number') {
            const screenW = window.innerWidth;
            if (tooltipStyle.left < 20) tooltipStyle.left = 20;
            if (tooltipStyle.left + CARD_WIDTH > screenW - 20) tooltipStyle.left = screenW - CARD_WIDTH - 20;
        }
        
        tooltipStyle.width = CARD_WIDTH;
        tooltipStyle.position = 'absolute';
        tooltipStyle.zIndex = 10001;
    }

    const isLastStep = currentStep === totalSteps;

    return createPortal(
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden touch-none">
            
            {/* 1. SPOTLIGHT EFFECT (Dark Overlay with Cutout) */}
            {/* We use a massive box-shadow on the target element wrapper to dim the rest of the screen */}
            <div 
                className="absolute rounded-lg transition-all duration-500 ease-in-out"
                style={{
                    top: coords.top - 4,
                    left: coords.left - 4,
                    width: coords.width + 8,
                    height: coords.height + 8,
                    // The magic: massive shadow dims the rest of the page
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)', 
                    zIndex: 10000 // Just below the tooltip
                }}
            >
                {/* Pulse Border for extra visibility */}
                <div className="absolute inset-0 border-2 border-indigo-500 rounded-lg animate-pulse"></div>
            </div>

            {/* 2. TOOLTIP CARD */}
            <div 
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-2xl pointer-events-auto flex flex-col gap-3 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300"
                style={tooltipStyle}
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
                    {/* Optional Prev Button */}
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
