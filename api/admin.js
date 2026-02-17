
import { sql } from '@vercel/postgres';
import { verifyUser, getClerkClient } from './_auth.js';
import { GoogleGenAI, Type } from "@google/genai";
import { encrypt, decrypt } from './_crypto.js';

export default async function handler(req, res) {
    const { action } = req.query;

    // --- PUBLIC / HYBRID ENDPOINTS ---

    // 1. Get Payment Config
    if (action === 'get_payment_config') {
        try {
            const user = await verifyUser(req); 
            let isAdmin = false;
            if (user && user.userId) {
                try {
                    const clerk = getClerkClient();
                    const clerkUser = await clerk.users.getUser(user.userId);
                    const role = clerkUser.publicMetadata?.role;
                    isAdmin = role === 'admin' || role === 'superadmin';
                } catch (e) {
                    console.warn("Failed to verify admin status for payment config", e);
                }
            }

            await sql`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value JSONB);`;
            const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'payment_config'`;
            const rawConfig = rows.length > 0 ? rows[0].value : {};

            if (isAdmin) {
                return res.status(200).json(rawConfig);
            } else {
                const safeConfig = {
                    ...rawConfig,
                    yookassa: { shopId: rawConfig.yookassa?.shopId },
                    prodamus: { url: rawConfig.prodamus?.url }
                };
                return res.status(200).json(safeConfig);
            }
        } catch (e) {
            console.error("Payment Config Error:", e);
            return res.status(200).json({});
        }
    }

    // 2. Get App Config
    if (action === 'get_config') {
        try {
            await sql`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value JSONB);`;
            const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'feature_flags'`;
            return res.status(200).json(rows.length > 0 ? rows[0].value : {});
        } catch (e) {
            return res.status(200).json({}); 
        }
    }

    // 3. Get App Version
    if (action === 'get_version') {
        try {
            await sql`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value JSONB);`;
            const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'app_version'`;
            return res.status(200).json(rows.length > 0 ? rows[0].value : null);
        } catch (e) {
            return res.status(200).json(null);
        }
    }

    // --- STRICT ADMIN ACTIONS ---
    try {
        const user = await verifyUser(req); 
        if (!user || !user.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const clerk = getClerkClient();
        
        // Robust Admin Check
        let isSuperAdmin = false;
        try {
            const clerkUser = await clerk.users.getUser(user.userId);
            const role = clerkUser.publicMetadata?.role;
            isSuperAdmin = role === 'admin' || role === 'superadmin';
        } catch(e) {
            console.error("Clerk User Fetch Error:", e);
            return res.status(500).json({ error: "Auth Service Unreachable" });
        }

        if (!isSuperAdmin) {
            return res.status(403).json({ error: "Forbidden: Admins only" });
        }

        // --- AI CONFIG MANAGEMENT ---
        if (action === 'get_ai_config') {
            if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
            
            const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'ai_config'`;
            const config = rows.length > 0 ? rows[0].value : { provider: 'gemini', openaiKey: '' };
            
            // Return empty/masked key for security in UI
            const hasOpenAiKey = !!config.openaiKey;
            
            return res.status(200).json({ 
                provider: config.provider || 'gemini',
                hasOpenAiKey 
            });
        }

        if (action === 'update_ai_config') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            
            const { provider, openaiKey } = req.body;
            
            // Get existing to preserve key if not updating
            const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'ai_config'`;
            let currentConfig = rows.length > 0 ? rows[0].value : {};

            const newConfig = {
                provider: provider || currentConfig.provider || 'gemini',
                openaiKey: currentConfig.openaiKey // Default keep old
            };

            if (openaiKey) {
                newConfig.openaiKey = encrypt(openaiKey);
            }

            await sql`INSERT INTO system_settings (key, value) VALUES ('ai_config', ${JSON.stringify(newConfig)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(newConfig)}::jsonb;`;
            return res.status(200).json({ success: true });
        }

        // --- META-PROMPT GENERATION (Uses Free Gemini) ---
        if (action === 'generate_meta_prompt') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            const { goal } = req.body;

            if (!process.env.API_KEY) return res.status(500).json({ error: "Gemini Key missing" });

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                
                // Detailed instructions for the "Prompt Engineer" AI
                const promptEngineeringTask = `
                    You are a World-Class Prompt Engineer. 
                    Your task is to write a PERFECT "System Instruction" for another AI to generate a social media post for "Anotee".
                    
                    Context: Anotee is a video collaboration platform (like Frame.io but simpler/cheaper). It helps filmmakers get feedback on videos with frame-accurate comments.
                    
                    Goal of the post: ${goal}
                    
                    Output Requirement:
                    Return ONLY the prompt text in Russian. Do not add "Here is the prompt".
                    The output prompt should be structured like this:
                    "Роль: [Role]
                    Задача: [Task]
                    Контекст: [Context about Anotee]
                    Боли аудитории: [Pain points related to ${goal}]
                    Структура поста: [Structure]
                    Тон: [Tone]"
                `;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash', // Fast & Free model
                    contents: promptEngineeringTask
                });

                return res.status(200).json({ prompt: response.text });
            } catch (e) {
                console.error("Meta Prompt Error:", e);
                return res.status(500).json({ error: "Failed to generate prompt template" });
            }
        }

        // --- MERGED: TEXT GENERATION (Gemini + OpenAI) ---
        if (action === 'generate_ai') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

            const { prompt, model, provider } = req.body; // provider explicitly passed from UI

            // Fetch config to check provider setting or keys
            const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'ai_config'`;
            const config = rows.length > 0 ? rows[0].value : {};
            
            const activeProvider = provider || config.provider || 'gemini';

            // --- OPENAI PATH ---
            if (activeProvider === 'openai') {
                const encryptedKey = config.openaiKey;
                const openAiKey = decrypt(encryptedKey);

                if (!openAiKey) return res.status(400).json({ error: "OpenAI API Key not configured." });

                try {
                    const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${openAiKey}`
                        },
                        body: JSON.stringify({
                            model: "gpt-4o", // Or gpt-4-turbo
                            messages: [
                                { role: "system", content: "You are an expert content marketer for Anotee (a video collaboration platform). Return ONLY valid JSON." },
                                { role: "user", content: `${prompt} 
                                
                                RETURN JSON ONLY matching this schema:
                                {
                                    "hook": "string",
                                    "body": "string",
                                    "cta": "string",
                                    "imageHint": "string",
                                    "category": "string"
                                }` }
                            ],
                            response_format: { type: "json_object" }
                        })
                    });

                    const data = await openAiRes.json();
                    if (!openAiRes.ok) throw new Error(data.error?.message || "OpenAI Error");
                    
                    const content = data.choices[0].message.content;
                    return res.status(200).json(JSON.parse(content));

                } catch (e) {
                    console.error("OpenAI Error:", e);
                    return res.status(500).json({ error: `OpenAI Failed: ${e.message}` });
                }
            }

            // --- GEMINI PATH (Default) ---
            if (!process.env.API_KEY) {
                return res.status(500).json({ error: "Server Configuration Error: API_KEY is missing." });
            }

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

                const responseSchema = {
                    type: Type.OBJECT,
                    properties: {
                        hook: { type: Type.STRING, description: "Цепляющий заголовок или первый абзац" },
                        body: { type: Type.STRING, description: "Основной текст поста (с абзацами)" },
                        cta: { type: Type.STRING, description: "Призыв к действию (Call to Action)" },
                        imageHint: { type: Type.STRING, description: "Описание идеи для визуализации/картинки" },
                        category: { type: Type.STRING, description: "Категория контента" }
                    },
                    required: ["hook", "body", "cta", "imageHint"],
                };

                const response = await ai.models.generateContent({
                    model: model || 'gemini-2.5-flash', 
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: responseSchema,
                        systemInstruction: "You are an expert content marketer for Anotee (a video collaboration platform for filmmakers). Your tone is professional, concise, and 'indie-hacker' style. Never use corporate jargon. Always reply in Russian.",
                    },
                });

                if (!response.text) {
                    throw new Error("Empty response from AI");
                }

                return res.status(200).json(JSON.parse(response.text));
            } catch(aiError) {
                console.error("Gemini API Error:", aiError);
                return res.status(500).json({ error: "AI Generation Failed: " + aiError.message });
            }
        }

        // --- IMAGE GENERATION (Imagen 3 / DALL-E 3) ---
        if (action === 'generate_image') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            
            const { prompt, provider } = req.body;
            if (!prompt) return res.status(400).json({ error: "Prompt required" });

            // Fetch config to determine active provider
            const { rows } = await sql`SELECT value FROM system_settings WHERE key = 'ai_config'`;
            const config = rows.length > 0 ? rows[0].value : {};
            const activeProvider = provider || config.provider || 'gemini';

            // --- OPENAI (DALL-E 3) ---
            if (activeProvider === 'openai') {
                const encryptedKey = config.openaiKey;
                const openAiKey = decrypt(encryptedKey);
                if (!openAiKey) return res.status(400).json({ error: "OpenAI API Key not configured." });

                try {
                    const response = await fetch('https://api.openai.com/v1/images/generations', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${openAiKey}`
                        },
                        body: JSON.stringify({
                            model: "dall-e-3",
                            prompt: `Professional UI Design, SaaS Interface, Dark Mode, Indigo Accents. ${prompt}`,
                            n: 1,
                            size: "1024x1024",
                            response_format: "b64_json"
                        })
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error?.message || "DALL-E Error");

                    const b64 = data.data[0].b64_json;
                    return res.status(200).json({ image: `data:image/png;base64,${b64}` });

                } catch (e) {
                    console.error("DALL-E Error:", e);
                    return res.status(500).json({ error: `DALL-E Failed: ${e.message}` });
                }
            }

            // --- GEMINI (Imagen 3) ---
            if (!process.env.API_KEY) return res.status(500).json({ error: "Google API Key missing" });

            // DESIGN SYSTEM INJECTION
            const designSystem = `
                Style: Professional SaaS Interface, Dark Mode, High Tech.
                Color Palette: Dark Background (#09090b), Indigo Accents (#4f46e5), White Text.
                Vibe: Cinematic lighting, 8k resolution, photorealistic or high-end 3D render.
                Context: A video collaboration platform interface on a screen.
            `;
            
            const fullPrompt = `${designSystem} \n Scene Description: ${prompt}`;

            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                
                // Using Imagen 3 model via standard SDK
                const response = await ai.models.generateImages({
                    model: 'imagen-3.0-generate-001',
                    prompt: fullPrompt,
                    config: {
                        numberOfImages: 1,
                        aspectRatio: '16:9',
                    },
                });

                const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
                if (!imageBytes) throw new Error("No image generated");

                return res.status(200).json({ 
                    image: `data:image/png;base64,${imageBytes}` 
                });

            } catch (e) {
                console.error("Image Gen Error:", e);
                return res.status(500).json({ error: e.message || "Failed to generate image" });
            }
        }

        // --- SETUP DATABASE ---
        if (action === 'setup') {
            // Setup is protected by secret param AND admin check now
            try {
                await sql`CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data JSONB NOT NULL, updated_at BIGINT, created_at BIGINT);`;
                await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS org_id TEXT;`;
                await sql`CREATE INDEX IF NOT EXISTS idx_owner_id ON projects (owner_id);`;
                await sql`CREATE INDEX IF NOT EXISTS idx_org_id ON projects (org_id);`;
                await sql`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value JSONB);`;
                return res.status(200).json({ success: true, message: "DB Setup Complete" });
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        }

        // --- MIGRATE DATA ---
        if (action === 'migrate') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            const BATCH_SIZE = 50;
            let offset = 0;
            let updatedCount = 0;
            let claimedCount = 0;
            let hasMore = true;

            while (hasMore) {
                const { rows } = await sql`SELECT id, owner_id, data FROM projects ORDER BY created_at DESC LIMIT ${BATCH_SIZE} OFFSET ${offset};`;
                if (rows.length === 0) { hasMore = false; break; }
                for (const row of rows) {
                    let project = row.data;
                    let currentOwnerId = row.owner_id;
                    if (currentOwnerId === user.email && user.email) {
                        currentOwnerId = user.id;
                        project.ownerId = user.id;
                        claimedCount++;
                    }
                    try {
                        await sql`UPDATE projects SET owner_id = ${currentOwnerId}, data = ${JSON.stringify(project)}::jsonb, org_id = ${project.orgId || null}, updated_at = ${Date.now()} WHERE id = ${project.id};`;
                        updatedCount++;
                    } catch (e) { console.error(e); }
                }
                offset += BATCH_SIZE;
                if (offset > 5000) hasMore = false; 
            }
            return res.status(200).json({ success: true, updatedProjects: updatedCount, claimedOwnerships: claimedCount });
        }

        // --- LIST USERS ---
        if (action === 'users') {
            if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
            
            try {
                const usersList = await clerk.users.getUserList({ limit: 100, orderBy: '-created_at' });
                const data = usersList.data.map(u => {
                    const meta = u.publicMetadata || {};
                    const email = u.emailAddresses.find(e => e.id === u.primaryEmailAddressId)?.emailAddress || 'No Email';
                    return {
                        id: u.id,
                        name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
                        email: email,
                        avatar: u.imageUrl,
                        plan: meta.plan || 'free',
                        expiresAt: meta.expiresAt,
                        isAutoRenew: !!meta.yookassaPaymentMethodId,
                        lastActive: u.lastSignInAt,
                        isAdmin: meta.role === 'admin' || meta.role === 'superadmin'
                    };
                });
                return res.status(200).json({ users: data });
            } catch(e) {
                console.error("Clerk List Error:", e);
                return res.status(500).json({ error: "Failed to fetch users list" });
            }
        }

        // --- GRANT PRO ---
        if (action === 'grant_pro') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            const { userId, days } = req.body;
            if (!userId) return res.status(400).json({ error: "Missing userId" });

            let expiresAt = null;
            if (days && typeof days === 'number') {
                expiresAt = days === 0 ? new Date('2099-12-31').getTime() : Date.now() + (days * 24 * 60 * 60 * 1000);
            } else {
                expiresAt = new Date('2099-12-31').getTime();
            }

            // SAFE MERGE
            const targetUser = await clerk.users.getUser(userId);
            const currentMeta = targetUser.publicMetadata || {};

            await clerk.users.updateUser(userId, {
                publicMetadata: {
                    ...currentMeta, // PRESERVE EXISTING DATA
                    plan: 'pro',
                    status: 'active',
                    expiresAt: expiresAt,
                    yookassaPaymentMethodId: null
                }
            });
            return res.status(200).json({ success: true, message: `Pro granted to ${userId}` });
        }

        // --- REVOKE PRO ---
        if (action === 'revoke_pro') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            const { userId } = req.body;
            
            // SAFE MERGE
            const targetUser = await clerk.users.getUser(userId);
            const currentMeta = targetUser.publicMetadata || {};

            await clerk.users.updateUser(userId, {
                publicMetadata: {
                    ...currentMeta, // PRESERVE
                    plan: 'free',
                    status: 'inactive',
                    expiresAt: null
                }
            });
            return res.status(200).json({ success: true });
        }

        // --- TOGGLE ADMIN ROLE ---
        if (action === 'toggle_admin') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            const { userId, makeAdmin } = req.body;
            if (userId === user.userId) return res.status(400).json({ error: "Cannot change own admin status" });

            // SAFE MERGE
            const targetUser = await clerk.users.getUser(userId);
            const currentMeta = targetUser.publicMetadata || {};

            await clerk.users.updateUser(userId, {
                publicMetadata: {
                    ...currentMeta,
                    role: makeAdmin ? 'admin' : 'user'
                }
            });
            return res.status(200).json({ success: true });
        }

        // --- UPDATE CONFIGS ---
        if (action === 'update_config') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            await sql`INSERT INTO system_settings (key, value) VALUES ('feature_flags', ${JSON.stringify(req.body)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(req.body)}::jsonb;`;
            return res.status(200).json({ success: true });
        }

        if (action === 'update_payment_config') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            await sql`INSERT INTO system_settings (key, value) VALUES ('payment_config', ${JSON.stringify(req.body)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(req.body)}::jsonb;`;
            return res.status(200).json({ success: true });
        }

        if (action === 'update_version') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            await sql`INSERT INTO system_settings (key, value) VALUES ('app_version', ${JSON.stringify(req.body)}::jsonb) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(req.body)}::jsonb;`;
            return res.status(200).json({ success: true });
        }

    } catch (error) {
        console.error("Admin API Error:", error);
        return res.status(500).json({ error: error.message });
    }

    return res.status(400).json({ error: 'Invalid action' });
}
