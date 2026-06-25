const fs = require('fs');
const path = require('path');
try {
    const targetPath = path.join(__dirname, 'node_modules', 'whatsapp-web.js', 'src', 'Client.js');
    const patchPath = path.join(__dirname, 'patches', 'Client.js');
    if (fs.existsSync(targetPath) && fs.existsSync(patchPath)) {
        fs.copyFileSync(patchPath, targetPath);
        console.log('Successfully patched whatsapp-web.js Client.js');
    }
} catch (e) { console.error('Patch failed:', e); }

require('dotenv').config();
require('dns').setServers(['8.8.8.8', '8.8.4.4']);
const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const MongoStore = require('./CustomMongoStore');
const mongoose = require('mongoose');
const express = require('express');
const ai = require('./ai');
const UserSession = require('./db');

// ── Language-aware message templates ───────────────────────────────────────
const MSGS = {
    welcome: {
        en:       `Hey! 👋 Welcome to Zybrex!\nI'm June, Jazi's AI assistant.\n\nPlease choose:\n1️⃣ Enquiry — Chat with June\n2️⃣ Personal — Talk directly with Jazi`,
        manglish: `Hai! 👋 Zybrex-il swagatham!\nNjan June, Jazi-nte AI assistant.\n\nThaazhe parayunnathu select cheyyuka:\n1️⃣ Enquiry — June-umayi samsaarikkam\n2️⃣ Personal — Jazi-ye direct aayi kaannam`,
        ml:       `ഹായ്! 👋 Zybrex-ൽ സ്വാഗതം!\nഞാൻ June, Jazi-യുടെ AI assistant.\n\nചുവടെ പറയുന്നത് select ചെയ്യൂ:\n1️⃣ Enquiry — June-ഉമായി സംസാരിക്കാം\n2️⃣ Personal — Jazi-യെ direct ആയി കാണണം`,
    },
    chat_june: {
        en:       `Great! I'm June 😊 How can I help you today?\n\n_(Type *2* anytime to reach Jazi)_`,
        manglish: `Pwoli! Njan June 😊 Endentha help cheyyendath?\n\n_(Jazi-ye kaannanam enkil *2* type cheyyuka)_`,
        ml:       `Pwoli! ഞാൻ June 😊 എന്ത് help ചെയ്യണം?\n\n_(Jazi-യെ കാണണമെങ്കിൽ *2* type ചെയ്യൂ)_`,
    },
    jazi_wait_ack: {
        en:       `Sure! 😊 Jazi is a bit busy right now. What do you need help with? I'll make sure he sees this.\n\n_(Type *1* anytime to chat with me)_`,
        manglish: `Seri! 😊 Jazi ippol kurachu busy aanu. Enthaa help veendathu? Njan urappaayi avan-e ariyikkunnu.\n\n_(Njan-umayi samsaarikkanam enkil *1* type cheyyuka)_`,
        ml:       `ശരി! 😊 Jazi ഇപ്പോൾ കുറച്ചു busy ആണ്. എന്താ help വേണ്ടത്? ഞാൻ ഉറപ്പായി അവനെ അറിയിക്കുന്നു.\n\n_(ഞാനുമായി സംസാരിക്കണമെങ്കിൽ *1* type ചെയ്യൂ)_`,
    },
    connecting: {
        en:       `⏳ Just a second... connecting you to Jazi (Boss)!`,
        manglish: `⏳ Oru second... Boss-ne (Jazi) connect cheyyunnu!`,
        ml:       `⏳ ഒരു second... Boss-നെ (Jazi) connect ചെയ്യുന്നു!`,
    },
    jazi_saw: {
        en:       `✅ Jazi has seen the message! He'll get back to you very soon! 🙌`,
        manglish: `✅ Jazi message kandu! Avan ippol varum! 🙌`,
        ml:       `✅ Jazi message കണ്ടു! അവൻ ഇപ്പോൾ വരും! 🙌`,
    },
    jazi_busy: {
        en:       `⏰ Jazi seems to be in something urgent right now. But I've sent the message — he'll reply as soon as he's free! 💪`,
        manglish: `⏰ Jazi ippol vere urgent pani-il aayirikkum. Pakshe message ayachirunnu — free aakumbol undaam varum! 💪`,
        ml:       `⏰ Jazi ഇപ്പോൾ വേറെ urgent പണിയിൽ ആയിരിക്കും. പക്ഷേ message അയച്ചിരുന്നു — free ആകുമ്പോൾ ഉടനേ വരും! 💪`,
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

// ── Alert tracker for blue-tick (read receipt) follow-up ───────────────────
const alertTracker = new Map(); // jaziMsgId → { userPhone, timer }

async function sendJaziAlertAndTrack(client, userPhone, userName, userLang) {
    const jaziNumber = '917356032512@c.us';
    const alertMsg = `🚨 *URGENT* 🚨\n\n*User:* ${userName}\n*Number:* +${userPhone.split('@')[0]}\n\n⚠️ They are waiting for you on Business WhatsApp RIGHT NOW!`;

    let trackedMsgId = null;
    for (let i = 0; i < 10; i++) {
        const sent = await client.sendMessage(jaziNumber, alertMsg);
        if (i === 0) trackedMsgId = sent.id._serialized; // track first message
        await new Promise(res => setTimeout(res, 1000));
    }

    if (trackedMsgId) {
        // After 3 minutes with no read → send "Jazi busy" to user
        const timer = setTimeout(async () => {
            if (alertTracker.has(trackedMsgId)) {
                alertTracker.delete(trackedMsgId);
                try {
                    await client.sendMessage(userPhone, getMsg('jazi_busy', userLang));
                } catch (e) { console.error('jazi_busy send error:', e); }
            }
        }, 3 * 60 * 1000);

        alertTracker.set(trackedMsgId, { userPhone, timer });
    }
}

// ── Express web server ──────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Zybrex AI WhatsApp Bot is running!'));
app.listen(PORT, () => console.log(`Web server is listening on port ${PORT}`));

// ── MongoDB + WhatsApp client ───────────────────────────────────────────────
if (!process.env.MONGODB_URI) {
    console.error('CRITICAL ERROR: MONGODB_URI is not set in .env!');
    process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log('Connected to MongoDB successfully!');

    const store = new MongoStore({ mongoose });

    const client = new Client({
        authStrategy: new RemoteAuth({ store, backupSyncIntervalMs: 300000 }),
        puppeteer: {
            executablePath: process.platform === 'win32'
                ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
                : undefined,
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas', '--no-first-run', '--no-zygote', 
                '--disable-gpu', '--single-process', '--memory-pressure-off'
            ]
        }
    });

    // ── QR / ready / session ────────────────────────────────────────────────
    client.on('qr', qr => {
        console.log('SCAN THIS QR CODE TO LOGIN TO WHATSAPP:');
        qrcode.generate(qr, { small: true });
    });
    client.on('remote_session_saved', () => console.log('WhatsApp Session successfully saved to MongoDB!'));
    client.on('ready', () => console.log('Zybrex AI Bot is successfully connected and ready!'));
    client.on('loading_screen', (percent, message) => console.log('LOADING SCREEN:', percent, message));
    client.on('authenticated', () => console.log('AUTHENTICATED!'));
    client.on('auth_failure', msg => console.error('AUTHENTICATION FAILURE:', msg));
    client.on('disconnected', reason => console.log('DISCONNECTED:', reason));

    // ── Blue-tick tracker: when Jazi reads the alert ────────────────────────
    client.on('message_ack', async (msg, ack) => {
        if (ack >= 3) { // 3 = READ (blue tick)
            const msgId = msg.id._serialized;
            if (alertTracker.has(msgId)) {
                const { userPhone, timer } = alertTracker.get(msgId);
                clearTimeout(timer);
                alertTracker.delete(msgId);
                try {
                    const session = await UserSession.findOne({ phoneNumber: userPhone });
                    const lang = session?.language || 'en';
                    await client.sendMessage(userPhone, getMsg('jazi_saw', lang));
                } catch (e) { console.error('jazi_saw send error:', e); }
            }
        }
    });

    // ── Main message handler ────────────────────────────────────────────────
    client.on('message', async (message) => {
        if (message.from === 'status@broadcast') return;

        try {
            const chat = await message.getChat();
            if (chat.isGroup) return;

            const userPhone = message.from;
            const bodyStr = message.body.trim().toLowerCase();
            const lang = ai.detectLanguage(message.body);

            // Get or create session from DB
            let session = await UserSession.findOne({ phoneNumber: userPhone });
            if (!session) {
                session = new UserSession({ phoneNumber: userPhone });
            }
            // Update language (non-English takes priority)
            if (lang !== 'en' || session.language === 'en') {
                session.language = lang;
            }
            const userLang = session.language;
            const currentState = session.state;

            // ── State machine ──────────────────────────────────────────────
            if (currentState === 'NEW') {
                await message.reply(getMsg('welcome', userLang));
                session.state = 'AWAITING_OPTION';

            } else if (bodyStr === '1' || bodyStr === '1️⃣') {
                await message.reply(getMsg('chat_june', userLang));
                session.state = 'CHATTING_WITH_JUNE';

            } else if (bodyStr === '2' || bodyStr === '2️⃣') {
                await message.reply(getMsg('jazi_wait_ack', userLang));
                session.state = 'WAITING_FOR_JAZI';
                await session.save();

                // Send 10 alerts and track blue tick
                try {
                    const contact = await message.getContact();
                    const userName = contact.pushname || userPhone.split('@')[0];
                    await message.reply(getMsg('connecting', userLang));
                    await sendJaziAlertAndTrack(client, userPhone, userName, userLang);
                } catch (e) { console.error('Alert send error:', e); }

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
                    await message.reply(getMsg('connecting', userLang));
                    session.state = 'WAITING_FOR_JAZI';
                    await session.save();

                    try {
                        const contact = await message.getContact();
                        const userName = contact.pushname || userPhone.split('@')[0];
                        await sendJaziAlertAndTrack(client, userPhone, userName, userLang);
                    } catch (e) { console.error('Alert send error:', e); }

                } else {
                    await message.reply(getMsg('jazi_option_change', userLang));
                    session.state = 'AWAITING_OPTION';
                }

            } else if (currentState === 'WAITING_FOR_JAZI') {
                // Jazi handles this directly — stay silent
            }

            await session.save();

        } catch (err) {
            console.error('Message handler error:', err);
        }
    });

    client.initialize().catch(err => console.error("Client Init Error:", err));

}).catch(err => {
    console.error('MongoDB Connection Error:', err);
});
