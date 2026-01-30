
import { HardDrive, Cloud, FileVideo } from 'lucide-react';

/**
 * Generates a robust unique identifier (UUID v4 style).
 * Falls back to timestamp+random if crypto is not available.
 */
export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

/**
 * Checks if a timestamp is older than X days
 */
export const isExpired = (timestamp: number, days: number = 7): boolean => {
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  return (now - timestamp) > (days * msPerDay);
};

export const getDaysRemaining = (timestamp: number, days: number = 7): number => {
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    const expirationDate = timestamp + (days * msPerDay);
    const diff = expirationDate - now;
    return Math.max(0, Math.ceil(diff / msPerDay));
};

/**
 * Generates a deterministic pastel color from a string (UserId).
 */
export const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // HSL colors are better for distinctive but pleasant UI colors
  // Use hash to pick Hue (0-360)
  const h = Math.abs(hash % 360);
  // Fixed Saturation and Lightness for consistency
  return `hsl(${h}, 70%, 60%)`; 
};

/**
 * Generates a professional fallback thumbnail (Canvas-drawn).
 * Used when video decoding fails or CORS blocks image extraction.
 */
const generateFallbackThumbnail = (filename: string): string => {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (!ctx) return 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44c?w=600&q=80';

        // 1. Background (Gradient based on filename)
        const hue = Math.abs(filename.split('').reduce((a,b)=>a+b.charCodeAt(0),0) % 360);
        const gradient = ctx.createLinearGradient(0, 0, 320, 180);
        gradient.addColorStop(0, `hsl(${hue}, 20%, 20%)`);
        gradient.addColorStop(1, `hsl(${hue}, 20%, 10%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 320, 180);

        // 2. Icon (Simple geometric representation of a play button/file)
        ctx.fillStyle = `hsla(${hue}, 60%, 60%, 0.2)`;
        ctx.beginPath();
        ctx.arc(160, 90, 40, 0, Math.PI * 2);
        ctx.fill();

        // 3. Text
        ctx.fillStyle = '#e4e4e7'; // zinc-200
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const ext = filename.split('.').pop()?.toUpperCase() || 'VIDEO';
        ctx.fillText(ext, 160, 90);
        
        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#a1a1aa'; // zinc-400
        ctx.fillText(filename.substring(0, 20) + (filename.length>20?'...':''), 160, 120);

        return canvas.toDataURL('image/jpeg', 0.6);
    } catch (e) {
        return 'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44c?w=600&q=80';
    }
};

/**
 * Generates a video thumbnail client-side.
 * Handles CORS issues gracefully with fallbacks.
 */
export const generateVideoThumbnail = (fileOrUrl: File | string): Promise<string> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    // Critical for remote URLs to allow canvas export
    video.crossOrigin = "anonymous"; 

    let srcUrl = '';
    let filename = 'Video';

    if (fileOrUrl instanceof File) {
        srcUrl = URL.createObjectURL(fileOrUrl);
        filename = fileOrUrl.name;
    } else {
        srcUrl = fileOrUrl;
        filename = 'Remote Video';
    }

    video.src = srcUrl;

    const cleanup = () => {
        if (fileOrUrl instanceof File) URL.revokeObjectURL(srcUrl);
        video.remove();
    };

    // Timeout safety (3s limit)
    const timeout = setTimeout(() => {
        cleanup();
        console.warn("Thumbnail generation timed out");
        resolve(generateFallbackThumbnail(filename));
    }, 3000); 

    video.onloadedmetadata = () => {
      // Seek to 10% or 2s, whichever is shorter, to avoid black frames at start
      const seekTime = Math.min(2.0, video.duration * 0.1);
      video.currentTime = seekTime || 0;
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // This line throws SecurityError if CORS is not valid
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            resolve(dataUrl);
        } else {
            resolve(generateFallbackThumbnail(filename));
        }
      } catch (e) {
        console.warn("Thumbnail generation failed (CORS/Codec):", e);
        // Fallback to generated image instead of generic unsplash
        resolve(generateFallbackThumbnail(filename));
      } finally {
        cleanup();
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      console.warn("Video load error for thumbnail");
      cleanup();
      resolve(generateFallbackThumbnail(filename));
    };
  });
};
