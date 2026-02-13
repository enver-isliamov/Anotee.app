
export default async function handler(req, res) {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
        return res.status(400).send("Missing URL parameter");
    }

    // STRICT SECURITY: Prevent SSRF by extracting only the File ID.
    // Do NOT trust the domain provided in the URL query directly for the fetch.
    // We support standard Drive Viewer URLs and Export URLs.
    // Regex matches alphanumeric IDs (usually 33 chars, sometimes longer)
    const idRegex = /[-\w]{25,}/;
    const match = url.match(idRegex);
    const fileId = match ? match[0] : null;

    // Check if it at least looks like a drive URL to avoid confusion, 
    // though the ID extraction is the real security barrier.
    const isDriveUrl = url.includes('drive.google.com') || url.includes('docs.google.com');

    if (!fileId || !isDriveUrl) {
        return res.status(400).send("Invalid Google Drive URL format");
    }

    // Construct the safe URL internally
    const safeUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    try {
        // Native fetch in Node 18+ does not need import
        const response = await fetch(safeUrl);
        
        if (!response.ok) {
            return res.status(response.status).send(`Upstream Error: ${response.statusText}`);
        }

        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        
        // Forward content headers
        const contentType = response.headers.get('content-type');
        const contentLength = response.headers.get('content-length');
        
        if (contentType) res.setHeader('Content-Type', contentType);
        if (contentLength) res.setHeader('Content-Length', contentLength);

        // Pipe the response body to the client
        // Node's native fetch body is a ReadableStream, we need to convert/pipe it
        if (response.body && typeof response.body.pipe === 'function') {
             response.body.pipe(res);
        } else {
             // Fallback for newer Node streams if .pipe isn't direct
             const arrayBuffer = await response.arrayBuffer();
             res.send(Buffer.from(arrayBuffer));
        }
        
    } catch (e) {
        console.error("Audio Proxy Error:", e);
        res.status(500).send("Internal Proxy Error");
    }
}
