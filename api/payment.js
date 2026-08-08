
import { verifyUser, getClerkClient } from './_auth.js';
import { sql } from '@vercel/postgres';
import { v4 as uuidv4 } from 'uuid';

// Helper to get active payment config
async function getPaymentConfig() {
    try {
        const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'payment_config'`;
        if (rows.length > 0) return rows[0].value;
    } catch (e) { console.warn("DB Config Error, using Env fallback"); }
    
    return {
        activeProvider: 'yookassa',
        prices: { lifetime: 4900, monthly: 490 },
        yookassa: { shopId: process.env.YOOKASSA_SHOP_ID, secretKey: process.env.YOOKASSA_SECRET_KEY },
        prodamus: { url: '', secretKey: '' }
    };
}

export default async function handler(req, res) {
    // 1. GLOBAL LOGGING & CORS
    const method = req.method ? req.method.toUpperCase() : 'UNKNOWN';
    const queryAction = req.query.action;
    
    console.log(`[PaymentAPI] Hit: ${method} URL: ${req.url}`);

    // Permissive CORS for Webhooks
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') return res.status(200).end();

    // 2. INTELLIGENT ROUTING
    // Check if this is a Webhook based on payload, IGNORING query params (fail-safe)
    const body = req.body || {};
    let isWebhook = false;
    let provider = 'yookassa';

    if (method === 'POST') {
        if (body.type === 'payment.succeeded' || body.type === 'payment.waiting_for_capture') {
            isWebhook = true;
            provider = 'yookassa';
            console.log("--> Detected YooKassa Webhook via Body");
        } else if (body.payment_status === 'success' || (req.headers['content-type']?.includes('x-www-form-urlencoded') && req.body?.payment_status)) {
            isWebhook = true;
            provider = 'prodamus';
            console.log("--> Detected Prodamus Webhook via Body");
        }
    }

    // Explicit webhook action override
    if (queryAction === 'webhook') isWebhook = true;

    // --- HANDLER: WEBHOOK ---
    if (isWebhook) {
        if (method === 'GET') {
            return res.status(200).json({ status: 'online', mode: 'webhook_listener' });
        }

        console.log(`🔔 Processing Webhook (${provider})`);

        try {
            const clerk = getClerkClient();

            // YOOKASSA LOGIC
            if (provider === 'yookassa') {
                const event = body;
                if (!event || event.type !== 'payment.succeeded') {
                    // We accept waiting_for_capture just to log it, but only process succeeded
                    console.log("YooKassa Event ignored:", event.type);
                    return res.status(200).send('OK'); 
                }

                const payment = event.object;
                const { userId, planType } = payment.metadata || {};
                const paymentMethodId = payment.payment_method?.id;

                console.log(`✅ YooKassa Success: User ${userId}, Plan ${planType}`);

                if (userId) {
                    await upgradeUser(clerk, userId, planType, paymentMethodId, payment.amount.value);
                }
                return res.status(200).send('OK');
            }

            // PRODAMUS LOGIC
            if (provider === 'prodamus') {
                // Parse body if it came as string/urlencoded (Prodamus quirk)
                let data = body;
                if (typeof body === 'string') {
                    try { data = JSON.parse(body); } catch(e) {}
                }
                
                // If Prodamus sends valid JSON in body
                const sysData = data.sys ? JSON.parse(data.sys) : {};
                const userId = sysData.userId;
                const planType = sysData.planType;

                console.log(`✅ Prodamus Success: User ${userId}`);

                if (userId) {
                    await upgradeUser(clerk, userId, planType, null, null);
                }
                return res.status(200).send('OK');
            }

        } catch (e) {
            console.error("❌ Webhook Fatal Error:", e);
            // Return 200 to prevent retry loops from payment provider if it's a code error
            return res.status(200).json({ error: "Internal processing error, logged." });
        }
    }

    // --- HANDLER: INIT PAYMENT ---
    if (queryAction === 'init') {
        if (method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        
        try {
            const user = await verifyUser(req);
            if (!user) return res.status(401).json({ error: 'Unauthorized' });

            const { planType } = req.body || {}; 
            const config = await getPaymentConfig();
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://anotee.com';

            // 1. If donationUrl is explicitly set in admin config, prefer it for donations
            if ((planType === 'donation' || !planType) && config.donationUrl && config.donationUrl.trim() !== '') {
                let url = config.donationUrl.trim();
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                return res.status(200).json({ confirmationUrl: url });
            }

            const effectivePlan = planType || 'donation';
            const amountVal = (config.prices && config.prices[effectivePlan]) || (effectivePlan === 'donation' ? 500 : 4900);
            const description = effectivePlan === 'donation' 
                ? 'Anotee - Поддержка проекта (Донат)' 
                : `Anotee ${effectivePlan === 'lifetime' ? 'Lifetime' : 'Pro'} Access`;

            console.log(`Creating Payment: ${user.userId || user.id} -> ${effectivePlan} (${amountVal} RUB)`);

            // YooKassa Init
            if (config.activeProvider === 'yookassa') {
                const { shopId, secretKey } = config.yookassa || {};
                if (!shopId || !secretKey || shopId === '' || secretKey === '') {
                    return res.status(400).json({ 
                        error: "ЮKassa не настроена. Пожалуйста, укажите 'Ссылка для донатов' или Shop ID / Secret Key в Админке (Платежи)." 
                    });
                }

                const authString = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
                
                const yooRes = await fetch('https://api.yookassa.ru/v3/payments', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${authString}`,
                        'Idempotence-Key': uuidv4(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        amount: { value: amountVal.toFixed(2), currency: 'RUB' },
                        capture: true,
                        confirmation: { type: 'redirect', return_url: `${appUrl}/?payment=success` },
                        description: description,
                        metadata: { userId: user.userId || user.id, planType: effectivePlan },
                        save_payment_method: effectivePlan === 'monthly'
                    })
                });

                const yooData = await yooRes.json();
                if (!yooRes.ok) {
                    console.error("YooKassa error response:", yooData);
                    return res.status(400).json({ 
                        error: yooData.description || "Ошибка ЮKassa. Проверьте настройки в Админке." 
                    });
                }
                
                return res.status(200).json({ 
                    confirmationUrl: yooData.confirmation?.confirmation_url,
                    paymentId: yooData.id 
                });
            }

            // Prodamus Init
            if (config.activeProvider === 'prodamus') {
                const { url } = config.prodamus || {};
                if (!url || url === '') {
                    return res.status(400).json({ 
                        error: "Prodamus не настроен. Пожалуйста, укажите 'Ссылка для донатов' или URL страницы Prodamus в Админке." 
                    });
                }
                const payUrl = `${url.replace(/\/$/, '')}/?order_id=${uuidv4()}&products[0][price]=${amountVal}&products[0][name]=${encodeURIComponent(description)}&sys=${JSON.stringify({userId: user.userId || user.id, planType: effectivePlan})}`;
                return res.status(200).json({ confirmationUrl: payUrl });
            }

            // If donationUrl fallback exists
            if (config.donationUrl && config.donationUrl.trim() !== '') {
                return res.status(200).json({ confirmationUrl: config.donationUrl });
            }

            return res.status(400).json({ 
                error: "Платежный шлюз не настроен. Укажите 'Ссылка для донатов' в Админке." 
            });

        } catch (e) {
            console.error("Init Error:", e);
            return res.status(500).json({ error: e.message || "Payment initialization failed" });
        }
    }

    // --- HANDLER: CANCEL SUB ---
    if (queryAction === 'cancel_sub') {
        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        
        const clerk = getClerkClient();
        const currentUserData = await clerk.users.getUser(user.userId);
        await clerk.users.updateUser(user.userId, {
            publicMetadata: { ...currentUserData.publicMetadata, yookassaPaymentMethodId: null, billingStatus: 'canceled' }
        });
        return res.status(200).json({ success: true });
    }

    // --- FALLBACK ---
    // If we got here with a GET request and no specific action, just show life signs
    if (method === 'GET') {
        return res.status(200).json({ status: 'ready', timestamp: Date.now() });
    }

    return res.status(404).json({ error: 'Unknown endpoint' });
}

// SHARED: User Upgrade Logic (Safe Merge)
async function upgradeUser(clerk, userId, planType, paymentMethodId, amount) {
    const user = await clerk.users.getUser(userId);
    const currentMeta = user.publicMetadata || {};
    
    let updates = { 
        ...currentMeta, 
        plan: 'pro', 
        status: 'active',
        billingStatus: 'active'
    };

    // Determine plan details
    const isLifetime = planType === 'lifetime' || (amount && parseFloat(amount) >= 2000);
    
    if (isLifetime) {
        updates.plan = 'lifetime';
        updates.expiresAt = new Date('2100-01-01').getTime();
        updates.yookassaPaymentMethodId = null; // No recur needed
    } else {
        updates.plan = 'pro';
        updates.expiresAt = Date.now() + (32 * 24 * 60 * 60 * 1000); // 32 days buffer
        if (paymentMethodId) updates.yookassaPaymentMethodId = paymentMethodId;
    }

    await clerk.users.updateUser(userId, { publicMetadata: updates });
    console.log(`USER UPGRADED: ${userId} -> ${updates.plan}`);
}
