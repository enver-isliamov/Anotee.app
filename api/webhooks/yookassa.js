
import { getClerkClient } from '../_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method not allowed');

    try {
        const event = req.body;

        // Basic validation
        if (!event || !event.type) {
            return res.status(400).send('Invalid event');
        }

        // We only care about success for now
        if (event.type === 'payment.succeeded') {
            const payment = event.object;
            const { userId, plan } = payment.metadata || {};
            const paymentMethodId = payment.payment_method?.id;

            if (userId) {
                console.log(`✅ Payment success for user: ${userId}. Plan: ${plan}`);

                const clerk = getClerkClient();
                
                // Calculate expiration (e.g., 30 days or Lifetime via magic date)
                // Since this is "Founder Lifetime" in the UI, we set a far future date
                // Or if monthly, set +30 days. Let's assume +30 days for safety/recurrence logic testing, 
                // but if it's lifetime, we handle it logically.
                // For this implementation, let's treat it as a Monthly Sub that auto-renews.
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

        // Always return 200 OK to Yookassa
        return res.status(200).send('OK');

    } catch (error) {
        console.error('Webhook Error:', error);
        return res.status(500).send('Server Error');
    }
}
