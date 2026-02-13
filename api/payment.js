
import { verifyUser, getClerkClient } from './_auth.js';
import { sql } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid';

// Helper to get active payment config from DB or Fallback to Env
async function getPaymentConfig() {
    try {
        const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'payment_config'`;
        if (rows.length > 0) {
            return rows[0].value;
        }
    } catch (e) {
        console.warn("Using Env Fallback for payment config");
    }
    
    // Fallback Config
    return {
        activeProvider: 'yookassa',
        prices: { lifetime: 4900, monthly: 490 },
        yookassa: {
            shopId: process.env.YOOKASSA_SHOP_ID,
            secretKey: process.env.YOOKASSA_SECRET_KEY
        },
        prodamus: {
            url: '', 
            secretKey: ''
        }
    };
}

export default async function handler(req, res) {
    const { action } = req.query;

    // --- 1. INIT PAYMENT (Frontend calls this) ---
    if (action === 'init') {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

        try {
            const user = await verifyUser(req);
            if (!user) return res.status(401).json({ error: 'Unauthorized' });

            const { planType } = req.body; // 'lifetime' or 'monthly'
            const validPlan = planType === 'monthly' ? 'monthly' : 'lifetime';

            const config = await getPaymentConfig();
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.origin;

            // Determine Price
            const amountVal = config.prices[validPlan] || (validPlan === 'lifetime' ? 4900 : 490);
            const amountStr = amountVal.toFixed(2);
            
            const description = validPlan === 'lifetime' 
                ? `Anotee Lifetime Access for ${user.email || user.id}`
                : `Anotee Pro Subscription (1 Month) for ${user.email || user.id}`;

            // --- STRATEGY: YOOKASSA ---
            if (config.activeProvider === 'yookassa') {
                const { shopId, secretKey } = config.yookassa;

                if (!shopId || !secretKey) {
                    return res.status(500).json({ error: 'Yookassa configuration missing' });
                }

                const paymentData = {
                    amount: { value: amountStr, currency: 'RUB' },
                    capture: true,
                    confirmation: { type: 'redirect', return_url: `${appUrl}/?payment=success` },
                    description: description,
                    metadata: { userId: user.userId, planType: validPlan },
                    save_payment_method: validPlan === 'monthly' // Only save card for monthly
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
            }

            // --- STRATEGY: PRODAMUS ---
            if (config.activeProvider === 'prodamus') {
                const { url, secretKey } = config.prodamus;
                
                if (!url || !secretKey) {
                    return res.status(500).json({ error: 'Prodamus configuration missing' });
                }

                const paymentPageUrl = url.replace(/\/$/, '');
                const orderId = `order_${user.userId}_${Date.now()}`;
                
                const queryParams = new URLSearchParams({
                    order_id: orderId,
                    products_score: '1',
                    'products[0][price]': amountStr,
                    'products[0][quantity]': '1',
                    'products[0][name]': description,
                    customer_email: user.email || '',
                    do: 'link', 
                    // Pass planType in sys to recover it in webhook
                    sys: JSON.stringify({ userId: user.userId, planType: validPlan }), 
                    urlReturn: `${appUrl}/?payment=success`,
                    urlSuccess: `${appUrl}/?payment=success`,
                    urlNotification: `${appUrl}/api/payment?action=webhook&provider=prodamus`
                });

                return res.status(200).json({
                    confirmationUrl: `${paymentPageUrl}/?${queryParams.toString()}`,
                    paymentId: orderId
                });
            }

            return res.status(500).json({ error: "Unknown payment provider" });

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
            // SAFE FETCH & MERGE
            const clerkUser = await clerk.users.getUser(user.userId);
            const currentMeta = clerkUser.publicMetadata || {};

            await clerk.users.updateUser(user.userId, {
                publicMetadata: {
                    ...currentMeta,
                    yookassaPaymentMethodId: null, // Disable auto-charge
                    billingStatus: 'canceled'
                }
            });

            return res.status(200).json({ success: true, message: "Auto-renewal disabled" });
        } catch (error) {
            console.error('Cancel Sub Error:', error);
            return res.status(500).json({ error: 'Failed to cancel subscription' });
        }
    }

    // --- 3. WEBHOOK ---
    if (action === 'webhook') {
        if (req.method !== 'POST') return res.status(405).send('Method not allowed');

        const provider = req.query.provider || 'yookassa'; 
        console.log(`🔔 Webhook received from: ${provider}`);

        try {
            // --- YOOKASSA HANDLER ---
            if (provider === 'yookassa') {
                const event = req.body;
                
                if (!event || !event.type) {
                    console.warn("Invalid Yookassa Webhook Event");
                    return res.status(400).send('Invalid event');
                }

                console.log('YooKassa Event:', event.type);

                if (event.type === 'payment.succeeded') {
                    const payment = event.object;
                    const { userId, planType } = payment.metadata || {};
                    const paymentMethodId = payment.payment_method?.id;

                    console.log(`Processing payment for User: ${userId}, Plan: ${planType}, Method: ${paymentMethodId}`);

                    if (userId) {
                        const clerk = getClerkClient();
                        
                        // CRITICAL: Fetch existing user first to PRESERVE other metadata (like admin role)
                        let currentMeta = {};
                        try {
                            const userObj = await clerk.users.getUser(userId);
                            currentMeta = userObj.publicMetadata || {};
                        } catch (fetchErr) {
                            console.error(`Failed to fetch user ${userId} for update`, fetchErr);
                            // Proceed with empty meta if fetch fails, better than crashing
                        }

                        let updates = { ...currentMeta, plan: 'pro', status: 'active' };
                        
                        // LIFETIME LOGIC
                        if (planType === 'lifetime' || (!planType && payment.amount.value >= 2000)) {
                             updates.plan = 'lifetime';
                             updates.expiresAt = new Date('2100-01-01').getTime();
                             updates.yookassaPaymentMethodId = null; // No recur needed
                        } 
                        // MONTHLY LOGIC
                        else {
                             updates.plan = 'pro';
                             updates.expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
                             updates.yookassaPaymentMethodId = paymentMethodId || updates.yookassaPaymentMethodId;
                        }

                        // SAFE UPDATE
                        await clerk.users.updateUser(userId, {
                            publicMetadata: updates
                        });
                        console.log(`✅ Clerk updated successfully for ${userId}. New Plan: ${updates.plan}`);
                    } else {
                        console.warn("⚠️ Payment succeeded but No User ID in metadata");
                    }
                }
                return res.status(200).send('OK');
            }

            // --- PRODAMUS HANDLER ---
            if (provider === 'prodamus') {
                // Production: Verify Signature (req.headers['sign'])
                const paymentStatus = req.body.payment_status; 
                const sysData = req.body.sys ? JSON.parse(req.body.sys) : {};
                const userId = sysData.userId;
                const planType = sysData.planType;

                console.log(`Prodamus Event: ${paymentStatus} for ${userId}`);

                if (paymentStatus === 'success' && userId) {
                    const clerk = getClerkClient();
                    
                    // SAFE FETCH & MERGE
                    let currentMeta = {};
                    try {
                        const userObj = await clerk.users.getUser(userId);
                        currentMeta = userObj.publicMetadata || {};
                    } catch (fetchErr) {
                        console.error(`Failed to fetch user ${userId}`, fetchErr);
                    }

                    let updates = { ...currentMeta, plan: 'pro', status: 'active' };

                    if (planType === 'lifetime') {
                        updates.plan = 'lifetime';
                        updates.expiresAt = new Date('2100-01-01').getTime();
                    } else {
                        updates.plan = 'pro';
                        updates.expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);
                    }

                    // SAFE UPDATE
                    await clerk.users.updateUser(userId, {
                        publicMetadata: updates
                    });
                    console.log(`✅ Clerk updated successfully for ${userId}`);
                }
                return res.status(200).send('OK');
            }

        } catch (error) {
            console.error('❌ Webhook Critical Error:', error);
            // Return 500 so provider retries (except for logic errors which we logged)
            return res.status(500).send('Server Error');
        }
    }

    return res.status(400).json({ error: 'Invalid action parameter.' });
}
