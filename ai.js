require('dotenv').config();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const JUNE_SYSTEM_PROMPT = `You are June, the friendly AI assistant of Zybrex — a creative tech company owned by Jazi.
Your job is to warmly greet customers and answer their enquiries about Zybrex services such as:
- Web development
- Mobile app development
- AI-powered solutions
- Digital marketing & branding

Guidelines:
- Be warm, helpful, and concise. Keep replies short and conversational (2-4 sentences max).
- Reply in the SAME language the user writes in (English, Malayalam, or Manglish).
- Do NOT use markdown formatting like **, ## etc.
- If the user clearly and urgently wants to speak to Jazi directly (the owner/boss), reply with ONLY this exact text: [CONNECT_JAZI]
- Otherwise, always try to help them yourself first.`;

async function getJuneReply(history, userMessage) {
    const messages = [
        { role: 'system', content: JUNE_SYSTEM_PROMPT },
        ...history.slice(-10),
        { role: 'user', content: userMessage },
    ];

    const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 300,
        temperature: 0.7,
    });

    const reply = response.choices[0].message.content;
    const newHistory = [
        ...history,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: reply },
    ];

    return { reply, history: newHistory };
}

function detectLanguage(text) {
    // Check for Malayalam unicode characters
    if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';

    // Check for common Manglish words
    const manglishWords = [
        'njan', 'ningal', 'undo', 'aano', 'okke', 'alle', 'enth',
        'eppo', 'evide', 'seri', 'haa', 'pwoli', 'enthaa', 'cheyyam',
        'cheyyoo', 'aanu', 'aayirunnu', 'paranju', 'poyii', 'vannoo',
        'venam', 'venda', 'kittum', 'illa', 'undo', 'undo?',
    ];
    const lower = text.toLowerCase();
    if (manglishWords.some(w => lower.includes(w))) return 'manglish';

    return 'en';
}

module.exports = { getJuneReply, detectLanguage };
