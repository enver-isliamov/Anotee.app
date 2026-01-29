
/**
 * Extracts audio from a video URL or Blob URL and resamples it to 16000Hz (required by Whisper).
 */
export async function extractAudioFromUrl(url: string): Promise<Float32Array> {
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
    } catch (e) {
        console.error("Audio extraction failed", e);
        throw new Error("Failed to extract audio. Possible CORS issue or format not supported.");
    } finally {
        // CRITICAL: Close context to release hardware resources and prevent browser limit errors
        if (audioContext.state !== 'closed') {
            await audioContext.close();
        }
    }
}
