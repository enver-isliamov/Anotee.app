
import { verifyUser } from '../_auth.js';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // 1. Auth Check
        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // 2. Validate Config
        const shopId = process.env.YOOKASSA_SHOP_ID;
        const secretKey = process.env.YOOKASSA_SECRET_KEY;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.origin;

        if (!shopId || !secretKey) {
            return res.status(500).json({ error: 'Payment configuration missing (Shop ID/Key)' });
        }

        // 3. Create Payment Object
        // Using "save_payment_method: true" for recurring payments
        const paymentData = {
            amount: {
                value: '2900.00', // Founder Price
                currency: 'RUB'
            },
            capture: true,
            confirmation: {
                type: 'redirect',
                return_url: `${appUrl}/?payment=success`
            },
            description: `Anotee Founder Access for ${user.email || user.id}`,
            metadata: {
                userId: user.userId, // Clerk User ID to link webhook later
                plan: 'pro'
            },
            save_payment_method: true 
        };

        // 4. Send to YooKassa
        const authString = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
        const idempotenceKey = uuidv4();

        const yooRes = await fetch('https://api.yookassa.ru/v3/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authString}`,
                'Idempotence-Key': idempotenceKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });

        const yooData = await yooRes.json();

        if (!yooRes.ok) {
            console.error('Yookassa Error:', yooData);
            return res.status(500).json({ error: 'Payment provider error', details: yooData });
        }

        // 5. Return confirmation URL to frontend
        return res.status(200).json({ 
            confirmationUrl: yooData.confirmation.confirmation_url,
            paymentId: yooData.id 
        });

    } catch (error) {
        console.error('Init Payment Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
