
import { getClerkClient } from './_auth.js';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
    // 1. Secure Cron
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const clerk = getClerkClient();
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;
    
    if (!shopId || !secretKey) return res.status(500).json({ error: 'Config missing' });

    try {
        // Find Expiring Users (simplified)
        const users = await clerk.users.getUserList({ limit: 100 });
        const now = Date.now();
        const tomorrow = now + (24 * 60 * 60 * 1000);
        const renewals = [];

        for (const user of users.data) {
            const meta = user.publicMetadata;
            if (meta.plan === 'pro' && meta.yookassaPaymentMethodId && meta.expiresAt) {
                if (meta.expiresAt < tomorrow) {
                    renewals.push(user);
                }
            }
        }

        console.log(`Found ${renewals.length} users for renewal`);

        const results = [];
        const authString = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

        for (const user of renewals) {
            try {
                const paymentRes = await fetch('https://api.yookassa.ru/v3/payments', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${authString}`,
                        'Idempotence-Key': uuidv4(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        amount: { value: '2900.00', currency: 'RUB' },
                        capture: true,
                        payment_method_id: user.publicMetadata.yookassaPaymentMethodId,
                        description: `Auto-renewal for ${user.id}`,
                        metadata: { userId: user.id }
                    })
                });

                const payment = await paymentRes.json();

                if (payment.status === 'succeeded') {
                    const newExpiry = Date.now() + (30 * 24 * 60 * 60 * 1000);
                    // FIX: Use updateUser instead of updateUserMetadata
                    await clerk.users.updateUser(user.id, {
                        publicMetadata: { ...user.publicMetadata, expiresAt: newExpiry }
                    });
                    results.push({ userId: user.id, status: 'renewed' });
                } else {
                    results.push({ userId: user.id, status: 'failed', reason: payment.status });
                }
            } catch (e) {
                console.error(`Renewal failed for ${user.id}`, e);
                results.push({ userId: user.id, status: 'error' });
            }
        }

        return res.status(200).json({ success: true, processed: results.length, details: results });

    } catch (error) {
        console.error('Cron Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
