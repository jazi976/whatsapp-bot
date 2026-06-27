require('dotenv').config();
require('dns').setServers(['8.8.8.8', '8.8.4.4']);

const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore }         = require('wwebjs-mongo');
const qrcode                 = require('qrcode-terminal');
const mongoose               = require('mongoose');
const express                = require('express');
const ai                     = require('./ai');
const UserSession            = require('./db');

// ── Message templates (English / Manglish / Malayalam) ─────────────────────
const MSGS = {
    welcome: {
        en:       `Hey! 👋 Welcome to Zybrex!\nI'm June, Jazi's AI assistant.\n\nPlease choose:\n1️⃣ Enquiry — Chat with June\n2️⃣ Personal — Talk directly with Jazi`,
        manglish: `Hai! 👋 Zybrex-il swagatham!\nNjan June, Jazi-nte AI assistant.\n\nThaazhe parayunnathu select cheyyuka:\n1️⃣ Enquiry — June-umayi samsaarikkam\n2️⃣ Personal — Jazi-ye direct aayi kaannam`,
        ml:       `ഹായ്! 👋 Zybrex-ൽ സ്വാഗതം!\nഞാൻ June, Jazi-യുടെ AI assistant.\n\nചുവടെ select ചെയ്യൂ:\n1️⃣ Enquiry — June-ഉമായി സംസാരിക്കാം\n2️⃣ Personal — Jazi-യെ direct ആയി കാണണം`,
    },
    chat_june: {
        en:       `Great! I'm June 😊 How can I help you today?\n\n_(Type *2* anytime to reach Jazi)_`,
        manglish: `Pwoli! Njan June 😊 Endentha help cheyyendath?\n\n_(Jazi-ye kaannanam enkil *2* type cheyyuka)_`,
        ml:       `Pwoli! ഞാൻ June 😊 എന്ത് help ചെയ്യണം?\n\n_(Jazi-യെ കാണണമെങ്കിൽ *2* type ചെയ്യൂ)_`,
    },
    jazi_wait_ack: {
        en:       `Sure! 😊 Jazi is a bit busy right now. What do you need help with? I'll make sure he sees this.\n\n_(Type *1* anytime to chat with me)_`,
        manglish: `Seri! 😊 Jazi ippol busy aanu. Enthaa help veendathu? Njan urappaayi avan-e ariyikkunnu.\n\n_(Njan-umayi samsaarikkanam enkil *1* type cheyyuka)_`,
        ml:       `ശരി! 😊 Jazi ഇപ്പോൾ busy ആണ്. എന്താ help വേണ്ടത്? ഞാൻ ഉറപ്പായി അവനെ അറിയിക്കുന്നു.\n\n_(ഞാനുമായി സംസാരിക്കണമെങ്കിൽ *1* type ചെയ്യൂ)_`,
    },
    connect_confirm: {
        en:       `🔗 Want me to connect you to Jazi (Boss) urgently?\n\nReply *Yes* to confirm!`,
        manglish: `🔗 Boss-ne (Jazi) ippol thanne connect cheyyatte?\n\n*Yes* ennu parayoo!`,
        ml:       `🔗 Boss-നെ (Jazi) ഇപ്പോൾ തന്നെ connect ചെയ്യട്ടെ?\n\n*Yes* എന്ന് പറയൂ!`,
    },
    invalid_option: {
        en:       `Please reply with exactly *1* or *2*.`,
        manglish: `*1* allenkil *2* mathram type cheyyuka please.`,
        ml:       `*1* അല്ലെങ്കിൽ *2* മാത്രം type ചെയ്യൂ please.`,
    },
    jazi_option_change: {
        en:       `😊 No problem! What else can I help you with?\n\n*1* - Chat with June\n*2* - Wait for Jazi`,
        manglish: `😊 Ok! Vere enthenkilum cheyyano?\n\n*1* - June-umayi samsaarikkam\n*2* - Jazi-ye wait cheyyam`,
        ml:       `😊 Ok! വേറെ എന്തെങ്കിലും ചെയ്യണോ?\n\n*1* - June-ഉമായി സംസാരിക്കാം\n*2* - Jazi-യെ wait ചെയ്യാം`,
    },
};

function getMsg(type, lang) {
    return MSGS[type]?.[lang] || MSGS[type]?.en || '';
}

// ── Express web server ──────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

let latestQR = null;
let botState = 'INITIALIZING';

app.get('/', (req, res) => {
    if (botState === 'INITIALIZING') {
        return res.send(`
            <html>
                <head><meta http-equiv="refresh" content="3"></head>
                <body style="font-family:sans-serif;text-align:center;margin-top:80px;background:#f0f2f5">
                    <h2>Zybrex Bot is Starting Up... ⏳</h2>
                    <p>Please wait while WhatsApp Web loads. The QR code will appear here shortly.</p>
                    <p><i>(This page will auto-refresh every 3 seconds)</i></p>
                </body>
            </html>
        `);
    }

    if (botState === 'QR_READY' && latestQR) {
        return res.send(`
            <html>
                <head><meta http-equiv="refresh" content="30"></head>
                <body style="font-family:sans-serif;text-align:center;margin-top:50px;background:#f0f2f5">
                    <h2>Zybrex Bot — WhatsApp Login</h2>
                    <p>Scan this QR Code with your WhatsApp to connect the bot.</p>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(latestQR)}"
                         alt="QR Code"
                         style="border:10px solid white;border-radius:10px;box-shadow:0 4px 8px rgba(0,0,0,0.1)"/>
                    <p><i>Reload this page if the QR code stops working.</i></p>
                </body>
            </html>
        `);
    }

    return res.send(`
        <html>
            <body style="font-family:sans-serif;text-align:center;margin-top:80px;background:#e6ffe6">
                <h2>✅ Zybrex AI WhatsApp Bot is Running!</h2>
                <p>The bot is successfully connected and ready to reply to messages.</p>
            </body>
        </html>
    `);
});

// Admin route — clear session and force fresh QR scan
app.get('/clear-session', async (req, res) => {
    const secret = process.env.ADMIN_SECRET || 'zybrex-admin';
    if (req.query.key !== secret) return res.status(403).send('Forbidden');
    try {
        await mongoose.connection.db.dropDatabase();
        res.send('Session cleared! Restart the service to get a fresh QR code.');
    } catch (e) {
        res.status(500).send('Error: ' + e.message);
    }
});

app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

// ── MongoDB connection ──────────────────────────────────────────────────────
if (!process.env.MONGODB_URI) {
    console.error('CRITICAL ERROR: MONGODB_URI environment variable is not set!');
    process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    console.log('Connected to MongoDB successfully!');

    // Clear WhatsApp session if CLEAR_SESSION=true (set in Render env vars)
    if (process.env.CLEAR_SESSION === 'true') {
        console.log('CLEAR_SESSION=true — clearing WhatsApp session from MongoDB...');
        try {
            await mongoose.connection.db.collection('whatsapp-RemoteAuth.files').deleteMany({});
            await mongoose.connection.db.collection('whatsapp-RemoteAuth.chunks').deleteMany({});
            console.log('WhatsApp session cleared successfully!');
        } catch (e) {
            console.error('Error clearing session:', e);
        }
    }

    const store = new MongoStore({ mongoose });

    // ── WhatsApp Client ─────────────────────────────────────────────────────
    const client = new Client({
        authStrategy: new RemoteAuth({
            store,
            backupSyncIntervalMs: 60000, // Save session every 1 minute
        }),
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ||
                (process.platform === 'win32'
                    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                    : undefined),
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--disable-extensions',
            ],
        },
    });

    // ── WhatsApp Events ─────────────────────────────────────────────────────
    client.on('qr', qr => {
        console.log('QR Code generated — visit the URL to scan:');
        latestQR = qr;
        botState = 'QR_READY';
        qrcode.generate(qr, { small: true });
    });

    client.on('authenticated', () => {
        console.log('AUTHENTICATED! WhatsApp login successful.');
        latestQR = null;
        botState = 'AUTHENTICATED';
    });

    client.on('ready', () => {
        console.log('✅ Zybrex AI Bot is READY and listening for messages!');
        botState = 'READY';
    });

    client.on('remote_session_saved', () => {
        console.log('✅ WhatsApp session saved to MongoDB successfully!');
    });

    client.on('auth_failure', msg => {
        console.error('Authentication failure:', msg);
        botState = 'INITIALIZING';
    });

    client.on('disconnected', reason => {
        console.log('Bot disconnected:', reason);
        botState = 'INITIALIZING';
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`Loading WhatsApp Web: ${percent}% — ${message}`);
    });

    // ── Message Handler ─────────────────────────────────────────────────────
    client.on('message', async (message) => {
        if (message.from === 'status@broadcast') return;

        try {
            const chat = await message.getChat();
            if (chat.isGroup) return; // Ignore group messages

            const userPhone  = message.from;
            const bodyStr    = message.body.trim().toLowerCase();
            const lang       = ai.detectLanguage(message.body);

            // Load or create user session from MongoDB
            let session = await UserSession.findOne({ phoneNumber: userPhone });
            if (!session) {
                session = new UserSession({ phoneNumber: userPhone });
            }

            // Update language (non-English takes priority)
            if (lang !== 'en' || session.language === 'en') {
                session.language = lang;
            }

            const userLang     = session.language;
            const currentState = session.state;

            // ── State Machine ───────────────────────────────────────────────
            if (currentState === 'NEW') {
                await message.reply(getMsg('welcome', userLang));
                session.state = 'AWAITING_OPTION';

            } else if (bodyStr === '1' || bodyStr === '1️⃣') {
                await message.reply(getMsg('chat_june', userLang));
                session.state = 'CHATTING_WITH_JUNE';

            } else if (bodyStr === '2' || bodyStr === '2️⃣') {
                await message.reply(getMsg('jazi_wait_ack', userLang));
                session.state = 'WAITING_FOR_JAZI';

            } else if (currentState === 'AWAITING_OPTION') {
                await message.reply(getMsg('invalid_option', userLang));

            } else if (currentState === 'CHATTING_WITH_JUNE') {
                await chat.sendStateTyping();
                const { reply, history: newHistory } = await ai.getJuneReply(session.chatHistory, message.body);

                if (reply.trim() === '[CONNECT_JAZI]') {
                    await message.reply(getMsg('connect_confirm', userLang));
                    session.state = 'REQUESTING_JAZI';
                } else {
                    await message.reply(reply);
                }
                session.chatHistory = newHistory;

            } else if (currentState === 'REQUESTING_JAZI') {
                const confirmWords = ['yes', 'ha', 'haa', 'ok', 'athe', 'okay', 'seri', 'confirm', 'sheri', 'aanu'];
                if (confirmWords.includes(bodyStr)) {
                    await message.reply(getMsg('jazi_wait_ack', userLang));
                    session.state = 'WAITING_FOR_JAZI';
                } else {
                    await message.reply(getMsg('jazi_option_change', userLang));
                    session.state = 'AWAITING_OPTION';
                }

            } else if (currentState === 'WAITING_FOR_JAZI') {
                // Jazi handles this directly — bot stays silent
            }

            await session.save();

        } catch (err) {
            console.error('Message handler error:', err);
        }
    });

    // Start the WhatsApp client
    client.initialize().catch(err => console.error('Client initialization error:', err));

}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});
