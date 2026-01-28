
import { Comment } from '../types';

/**
 * Generates an EDL optimized for DaVinci Resolve Markers.
 * Format:
 * TITLE: ...
 * FCM: NON-DROP FRAME
 * 
 * 001  001      V     C        00:00:00:00 00:00:00:01 00:00:00:00 00:00:00:01
 * Comment Text |C:Color |M:Name |D:Duration
 */
export const generateEDL = (projectName: string, version: number, comments: Comment[]): string => {
  let edl = `TITLE: ${projectName}_v${version} Markers\nFCM: NON-DROP FRAME\n\n`;

  comments.forEach((comment, index) => {
    // Standardize FPS to 24 for export calculation
    const fps = 24;
    
    // Calculate IN point
    const inFramesTotal = Math.floor(comment.timestamp * fps);
    
    // Calculate OUT point
    // If range comment (duration > 0), use that. Else default to 1 frame for point marker.
    const durationFrames = comment.duration ? Math.floor(comment.duration * fps) : 1;
    const outFramesTotal = inFramesTotal + durationFrames;
    
    // Format Timecodes (HH:MM:SS:FF)
    const formatTC = (frames: number) => {
        const hh = Math.floor(frames / (3600 * fps)).toString().padStart(2, '0');
        const remaining1 = frames % (3600 * fps);
        const mm = Math.floor(remaining1 / (60 * fps)).toString().padStart(2, '0');
        const remaining2 = remaining1 % (60 * fps);
        const ss = Math.floor(remaining2 / fps).toString().padStart(2, '0');
        const ff = (remaining2 % fps).toString().padStart(2, '0');
        return `${hh}:${mm}:${ss}:${ff}`;
    };

    const tcIn = formatTC(inFramesTotal);
    const tcOut = formatTC(outFramesTotal);
    
    // Resolve Color Mapping
    // 'resolved' -> Blue (Completed), 'open' -> Red (Needs Attention)
    const color = comment.status === 'resolved' ? 'ResolveColorBlue' : 'ResolveColorRed';
    
    // Marker Name (Author or User ID)
    const markerName = comment.authorName || comment.userId;
    
    // Clean text to remove newlines for EDL safety
    const cleanText = comment.text.replace(/\n/g, ' ');

    // Construct EDL Block
    // Index line: NNN  001      V     C        In Out In Out
    const indexStr = (index + 1).toString().padStart(3, '0');
    edl += `${indexStr}  001      V     C        ${tcIn} ${tcOut} ${tcIn} ${tcOut}\n`;
    
    // Data line: Text |C:Color |M:Name |D:Duration
    edl += `${cleanText} |C:${color} |M:${markerName} |D:${durationFrames}\n\n`;
  });

  return edl;
};

/**
 * Generates a CSV file compatible with some marker import scripts in Resolve/Premiere.
 */
export const generateCSV = (comments: Comment[]): string => {
  let csv = 'Timecode, Name, Description, Color\n';
  
  comments.forEach(c => {
    // Simple HH:MM:SS format
    const date = new Date(0);
    date.setSeconds(c.timestamp);
    const tc = date.toISOString().substr(11, 8);
    
    csv += `${tc}, "${c.userId}", "${c.text.replace(/"/g, '""')}", "${c.status === 'resolved' ? 'Green' : 'Red'}"\n`;
  });

  return csv;
};

/**
 * Generates an FCP7 XML (xmeml) compatible with DaVinci Resolve Timeline Import.
 * This allows importing markers with colors and specific timecodes directly.
 */
export const generateResolveXML = (projectName: string, version: number, comments: Comment[]): string => {
  const fps = 24;
  const timebase = 24;
  
  // Helper to get frame count
  const getFrames = (seconds: number) => Math.floor(seconds * fps);

  let markersXML = '';
  
  comments.forEach((c) => {
    const frame = getFrames(c.timestamp);
    const color = c.status === 'resolved' ? 'Green' : 'Red';
    
    markersXML += `
          <marker>
            <name>${c.userId}</name>
            <comment>${c.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</comment>
            <in>${frame}</in>
            <out>${frame}</out>
            <color>
              <name>${color}</name>
            </color>
          </marker>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence>
    <name>${projectName}_v${version} (SmoTree Import)</name>
    <rate>
      <timebase>${timebase}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <media>
      <video>
        <track>
          <clipitem>
            <name>SmoTree Markers Placeholder</name>
            <duration>${getFrames(3600)}</duration>
            <rate>
              <timebase>${timebase}</timebase>
              <ntsc>FALSE</ntsc>
            </rate>
            ${markersXML}
          </clipitem>
        </track>
      </video>
    </media>
  </sequence>
</xmeml>`;
};

export const downloadFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
