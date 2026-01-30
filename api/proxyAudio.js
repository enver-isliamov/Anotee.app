
import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { url } = req.query;

    if (!url || typeof url !== 'string' || !url.includes('drive.google.com')) {
        return res.status(400).send("Invalid Google Drive URL");
    }

    try {
        const response = await fetch(url);
        
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
        response.body.pipe(res);
        
    } catch (e) {
        console.error("Audio Proxy Error:", e);
        res.status(500).send("Internal Proxy Error");
    }
}
