
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { verifyUser } from '../_auth.js';
import { getS3Client } from '../_s3.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    try {
        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const { operation, key, contentType } = req.body;

        if (!operation || !key) {
            return res.status(400).json({ error: "Missing operation or key" });
        }

        const { s3, config } = await getS3Client(user.id);
        
        let command;
        let expiresIn = 3600; // 1 hour link validity

        if (operation === 'put') {
            command = new PutObjectCommand({
                Bucket: config.bucket,
                Key: key,
                ContentType: contentType || 'application/octet-stream',
                // ACL: 'public-read' // Optional: depending on bucket policy
            });
        } else if (operation === 'get') {
            command = new GetObjectCommand({
                Bucket: config.bucket,
                Key: key
            });
        } else {
            return res.status(400).json({ error: "Invalid operation" });
        }

        const url = await getSignedUrl(s3, command, { expiresIn });

        return res.status(200).json({ 
            url, 
            key,
            publicUrl: config.public_url // Return custom domain if set
        });

    } catch (error) {
        console.error("Presign Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
