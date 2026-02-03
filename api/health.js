
export default function handler(req, res) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const region = req.headers['x-vercel-ip-country'] || 'Unknown';
    
    // Allow CORS for connectivity checks
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    res.status(200).json({ 
        status: 'ok', 
        message: 'Anotee is online', 
        timestamp: Date.now(),
        client_region: region,
        powered_by: 'Vercel'
    });
}
