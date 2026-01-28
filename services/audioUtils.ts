
/**
 * Extracts audio from a video URL or Blob URL and resamples it to 16000Hz (required by Whisper).
 */
export async function extractAudioFromUrl(url: string): Promise<Float32Array> {
    try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
            sampleRate: 16000, // Whisper expects 16kHz
        });

        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Get the first channel (mono)
        let audioData = audioBuffer.getChannelData(0);

        // If simple fetch/decode works, great.
        // Note: For very long videos, this consumes a lot of RAM. 
        // In a full PRO production app, we would stream this.
        return audioData;
    } catch (e) {
        console.error("Audio extraction failed", e);
        throw new Error("Failed to extract audio. Possible CORS issue or format not supported.");
    }
}
