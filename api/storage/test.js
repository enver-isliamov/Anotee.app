
import { verifyUser } from '../_auth.js';
import { getS3Client } from '../_s3.js';
import { ListObjectsV2Command, HeadBucketCommand } from '@aws-sdk/client-s3';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

    try {
        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        // 1. Get S3 Client
        const { s3, config } = await getS3Client(user.id);

        console.log(`Testing S3 connection for user ${user.id} to ${config.endpoint}`);

        // 2. Try simple operation
        // We prefer HeadBucket to check existence and permissions
        // If that fails, we try listing 1 object
        try {
            const command = new HeadBucketCommand({ Bucket: config.bucket });
            await s3.send(command);
        } catch (e) {
            console.warn("HeadBucket failed, trying ListObjects:", e.message);
            // Fallback: Try listing objects (some providers restrict HeadBucket)
            const listCmd = new ListObjectsV2Command({ Bucket: config.bucket, MaxKeys: 1 });
            await s3.send(listCmd);
        }

        return res.status(200).json({ 
            success: true, 
            message: "Connection Successful", 
            bucket: config.bucket,
            provider: config.provider 
        });

    } catch (error) {
        console.error("S3 Test Failed:", error);
        
        // Improve error message for user
        let msg = error.message;
        if (msg.includes("InvalidAccessKeyId")) msg = "Неверный Access Key ID";
        if (msg.includes("SignatureDoesNotMatch")) msg = "Неверный Secret Key";
        if (msg.includes("NoSuchBucket")) msg = "Бакет с таким именем не найден";
        if (msg.includes("ENOTFOUND") || msg.includes("EAI_AGAIN")) msg = "Неверный Endpoint URL";

        return res.status(500).json({ success: false, error: msg });
    }
}
