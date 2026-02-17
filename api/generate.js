
import { GoogleGenAI, Type } from "@google/genai";
import { verifyUser, getClerkClient } from './_auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // 1. Auth Check (Admins Only)
        const user = await verifyUser(req);
        if (!user) return res.status(401).json({ error: "Unauthorized" });

        const clerk = getClerkClient();
        const clerkUser = await clerk.users.getUser(user.userId);
        const role = clerkUser.publicMetadata?.role;
        
        if (role !== 'admin' && role !== 'superadmin') {
            return res.status(403).json({ error: "Forbidden: AI generation is for admins only." });
        }

        const { prompt, model } = req.body;

        if (!process.env.API_KEY) {
            return res.status(500).json({ error: "Server Error: API_KEY is missing." });
        }

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        // 2. Define Output Schema
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

        // 3. Call Gemini
        // We use gemini-2.5-flash for speed and cost efficiency as per guidelines for basic text tasks
        const response = await ai.models.generateContent({
            model: model || 'gemini-2.5-flash', 
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                systemInstruction: "You are an expert content marketer for Anotee (a video collaboration platform for filmmakers). Your tone is professional, concise, and 'indie-hacker' style. Never use corporate jargon. Always reply in Russian.",
            },
        });

        // 4. Return Data
        const text = response.text;
        // The output is guaranteed JSON due to responseMimeType
        const json = JSON.parse(text);

        return res.status(200).json(json);

    } catch (e) {
        console.error("AI Gen Error:", e);
        return res.status(500).json({ error: e.message || "AI Generation Failed" });
    }
}
