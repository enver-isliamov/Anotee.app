
import { verifyUser, getClerkClient } from './_auth.js';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
    const { action } = req.query;

    // --- 1. INIT PAYMENT (Frontend calls this) ---
    if (action === 'init') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        try {
            const user = await verifyUser(req);
            if (!user) return res.status(401).json({ error: 'Unauthorized' });

            const shopId = process.env.YOOKASSA_SHOP_ID;
            const secretKey = process.env.YOOKASSA_SECRET_KEY;
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.origin;

            if (!shopId || !secretKey) {
                return res.status(500).json({ error: 'Payment configuration missing' });
            }

            const paymentData = {
                amount: { value: '2900.00', currency: 'RUB' },
                capture: true,
                confirmation: { type: 'redirect', return_url: `${appUrl}/?payment=success` },
                description: `Anotee Founder Access for ${user.email || user.id}`,
                metadata: { userId: user.userId, plan: 'pro' },
                save_payment_method: true 
            };

            const authString = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
            
            const yooRes = await fetch('https://api.yookassa.ru/v3/payments', {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Idempotence-Key': uuidv4(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(paymentData)
            });

            const yooData = await yooRes.json();

            if (!yooRes.ok) {
                console.error('Yookassa Error:', yooData);
                return res.status(500).json({ error: 'Payment provider error', details: yooData });
            }

            return res.status(200).json({ 
                confirmationUrl: yooData.confirmation.confirmation_url,
                paymentId: yooData.id 
            });

        } catch (error) {
            console.error('Init Payment Error:', error);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // --- 2. CANCEL SUBSCRIPTION (Disable Auto-renew) ---
    if (action === 'cancel_sub') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        
        try {
            const user = await verifyUser(req);
            if (!user) return res.status(401).json({ error: 'Unauthorized' });

            const clerk = getClerkClient();
            
            // Fetch current metadata to preserve other fields
            const clerkUser = await clerk.users.getUser(user.userId);
            const currentMeta = clerkUser.publicMetadata || {};

            // Remove payment method but keep plan and expiry
            await clerk.users.updateUserMetadata(user.userId, {
                publicMetadata: {
                    ...currentMeta,
                    yookassaPaymentMethodId: null // Disable auto-charge
                }
            });

            return res.status(200).json({ success: true, message: "Auto-renewal disabled" });
        } catch (error) {
            console.error('Cancel Sub Error:', error);
            return res.status(500).json({ error: 'Failed to cancel subscription' });
        }
    }

    // --- 3. WEBHOOK (Yookassa calls this) ---
    if (action === 'webhook') {
        if (req.method !== 'POST') return res.status(405).send('Method not allowed');

        try {
            const event = req.body;
            if (!event || !event.type) return res.status(400).send('Invalid event');

            if (event.type === 'payment.succeeded') {
                const payment = event.object;
                const { userId, plan } = payment.metadata || {};
                const paymentMethodId = payment.payment_method?.id;

                if (userId) {
                    console.log(`✅ Payment success for user: ${userId}`);
                    const clerk = getClerkClient();
                    
                    // 30 days subscription
                    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); 

                    await clerk.users.updateUserMetadata(userId, {
                        publicMetadata: {
                            plan: 'pro',
                            status: 'active',
                            expiresAt: expiresAt,
                            yookassaPaymentMethodId: paymentMethodId || null
                        }
                    });
                }
            }
            return res.status(200).send('OK');
        } catch (error) {
            console.error('Webhook Error:', error);
            return res.status(500).send('Server Error');
        }
    }

    return res.status(400).json({ error: 'Invalid action parameter.' });
}
