
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();
let loaded = false;

const load = async () => {
    if (loaded) return;
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    loaded = true;
};

self.onmessage = async (event) => {
    const { file, type } = event.data;

    if (type === 'transcode') {
        try {
            await load();
            
            const inputName = 'input' + getExtension(file.name);
            const outputName = 'output.mp4';

            await ffmpeg.writeFile(inputName, await fetchFile(file));

            // Transcode to 720p H.264 (Fast preset for speed)
            // -vf scale=-2:720 : Resize to 720p height, keep aspect ratio
            // -c:v libx264 : Use H.264 codec
            // -preset ultrafast : Prioritize speed over compression size
            // -crf 28 : Slight quality reduction for speed (still good for proxies)
            await ffmpeg.exec([
                '-i', inputName,
                '-vf', 'scale=-2:720', 
                '-c:v', 'libx264',
                '-preset', 'ultrafast',
                '-crf', '28',
                '-c:a', 'aac',
                '-b:a', '128k',
                outputName
            ]);

            const data = await ffmpeg.readFile(outputName);
            const blob = new Blob([data], { type: 'video/mp4' });
            const resultFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + "_proxy.mp4", { type: 'video/mp4' });

            self.postMessage({ type: 'done', file: resultFile });

            // Cleanup
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputName);

        } catch (error: any) {
            console.error("Worker Transcode Error:", error);
            self.postMessage({ type: 'error', error: error.message });
        }
    }
};

function getExtension(filename: string) {
    const parts = filename.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
}