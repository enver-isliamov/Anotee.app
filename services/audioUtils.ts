
// Limit for browser-side processing to prevent tab crashes (Out Of Memory)
const MAX_FILE_SIZE_MB = 300;
const MAX_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Extracts audio from a video URL or Blob URL and resamples it to 16000Hz (required by Whisper).
 * Includes safety checks for file size.
 */
export async function extractAudioFromUrl(url: string): Promise<Float32Array> {
    let fetchUrl = url;

    // Detect Google Drive URL and route through proxy to bypass CORS
    if (url.includes('drive.google.com')) {
        fetchUrl = `/api/proxyAudio?url=${encodeURIComponent(url)}`;
    }

    // 1. Safety Check for Remote URLs (Head Request)
    if (fetchUrl.startsWith('http')) {
        try {
            const head = await fetch(fetchUrl, { method: 'HEAD' });
            if (head.ok) {
                const size = parseInt(head.headers.get('content-length') || '0', 10);
                if (size > MAX_BYTES) {
                    throw new Error(`File too large for browser AI (${(size / 1024 / 1024).toFixed(0)}MB). Limit is ${MAX_FILE_SIZE_MB}MB.`);
                }
            }
        } catch (e: any) {
            // If HEAD fails, we might proceed but warn. 
            // If it's the proxy, it should handle CORS, so HEAD might actually work now!
            if (e.message.includes('too large')) throw e;
            console.warn("Could not verify file size via HEAD, proceeding...", e);
        }
    }

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, // Whisper expects 16kHz
    });

    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
        
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
        // CRITICAL: Close context to release hardware resources
        if (audioContext.state !== 'closed') {
            await audioContext.close();
        }
    }
}
