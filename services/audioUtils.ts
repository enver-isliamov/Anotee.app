
// Limit for browser-side processing to prevent tab crashes (Out Of Memory)
const MAX_FILE_SIZE_MB = 300;
const MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Extracts audio from a video URL or Blob URL and resamples it to 16000Hz (required by Whisper).
 * Includes safety checks for file size.
 */
export async function extractAudioFromUrl(url: string): Promise<Float32Array> {
    // 1. Safety Check for Remote URLs
    if (url.startsWith('http')) {
        try {
            const head = await fetch(url, { method: 'HEAD' });
            if (head.ok) {
                const size = parseInt(head.headers.get('content-length') || '0', 10);
                if (size > MAX_BYTES) {
                    throw new Error(`File too large for browser AI (${(size / 1024 / 1024).toFixed(0)}MB). Limit is ${MAX_FILE_SIZE_MB}MB.`);
                }
            }
        } catch (e: any) {
            // If HEAD fails (CORS?), we might proceed but warn, or if specifically size error, rethrow
            if (e.message.includes('too large')) throw e;
            console.warn("Could not verify file size, proceeding with caution...", e);
        }
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, // Whisper expects 16kHz
    });

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch audio: ${response.statusText}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Get the first channel (mono)
        const audioData = audioBuffer.getChannelData(0);

        return audioData;
    } catch (e: any) {
        console.error("Audio extraction failed", e);
        if (e.message.includes('too large')) throw e;
        throw new Error("Failed to extract audio. The file might be corrupted, too large, or format unsupported.");
    } finally {
        // CRITICAL: Close context to release hardware resources and prevent browser limit errors
        if (audioContext.state !== 'closed') {
            await audioContext.close();
        }
    }
}
