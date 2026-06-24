require('dotenv').config();
require('dns').setServers(['8.8.8.8', '8.8.4.4']);
const { Client, RemoteAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const MongoStore = require('./CustomMongoStore');
const mongoose = require('mongoose');
const express = require('express');
const ai = require('./ai');

// State Manager
const userStates = {};
function getUserState(from) { return userStates[from] || "NEW"; }
function setUserState(from, state) { userStates[from] = state; }

// 1. Setup Express Web Server (Required for Cloud Hosting like Render)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Zybrex AI WhatsApp Bot is running!');
});

app.listen(PORT, () => {
    console.log(`Web server is listening on port ${PORT}`);
});

// 2. Connect to MongoDB and Initialize WhatsApp Client
if (!process.env.MONGODB_URI) {
    console.error("CRITICAL ERROR: MONGODB_URI is not set in .env!");
    console.error("Please add MONGODB_URI=mongodb+srv://... to your .env file.");
    process.exit(1);
}

mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log("Connected to MongoDB successfully!");
    
    const store = new MongoStore({ mongoose: mongoose });
    
    const client = new Client({
        authStrategy: new RemoteAuth({
            store: store,
            backupSyncIntervalMs: 300000
        }),
        puppeteer: {
            executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for cloud environments
        }
    });

    client.on('qr', (qr) => {
        console.log('SCAN THIS QR CODE TO LOGIN TO WHATSAPP:');
        qrcode.generate(qr, { small: true });
    });

    client.on('remote_session_saved', () => {
        console.log('WhatsApp Session successfully saved to MongoDB!');
    });

    client.on('ready', () => {
        console.log('Zybrex AI Bot is successfully connected and ready!');
    });

    client.on('message', async (message) => {
        if (message.from === 'status@broadcast') return;

        try {
            const chat = await message.getChat();
            if (chat.isGroup) return;

            const currentState = getUserState(message.from);
            const bodyStr = message.body.trim().toLowerCase();

            if (currentState === "NEW") {
                const welcomeMsg = `Hey! 👋 Welcome to Zybrex!\nI'm June, Jazi's AI assistant.\n\nPlease choose:\n1️⃣ Enquiry — Chat with June\n2️⃣ Personal — Talk privately with Jazi`;
                await message.reply(welcomeMsg);
                setUserState(message.from, "AWAITING_OPTION");
                
            } else if (currentState === "AWAITING_OPTION" || bodyStr === '1' || bodyStr === '1️⃣' || bodyStr === '2' || bodyStr === '2️⃣') {
                
                if (bodyStr === '1' || bodyStr === '1️⃣') {
                    await message.reply("Great! I am June. Endentha ariyanam? How can I help you today? 😊\n\n_(Type *2* anytime to wait for Jazi)_");
                    setUserState(message.from, "CHATTING_WITH_JUNE");
                } else if (bodyStr === '2' || bodyStr === '2️⃣') {
                    await message.reply("Sure! 😊 Jazi is a bit busy right now (probably in a small BC lol 😄). But I'm here! What do you need help with? I'll make sure Jazi sees this.\n\n_(Type *1* anytime to chat with me again)_");
                    setUserState(message.from, "WAITING_FOR_JAZI");
                } else if (currentState === "AWAITING_OPTION") {
                    await message.reply("Please reply with exactly *1* or *2*.");
                }
                
            } else if (currentState === "CHATTING_WITH_JUNE") {
                await chat.sendStateTyping();
                const aiReply = await ai.getJuneReply(message.from, message.body);
                await message.reply(aiReply);
            } else if (currentState === "WAITING_FOR_JAZI") {
                // Do nothing, Jazi will handle it.
            }

        } catch (err) {
            console.error(err);
        }
    });

    client.initialize();

}).catch((err) => {
    console.error("MongoDB Connection Error:", err);
});
