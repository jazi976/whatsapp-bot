const config = require('./config.json');

function getReply(incomingMessage) {
    if (!incomingMessage || typeof incomingMessage !== 'string') return null;
    
    const message = incomingMessage.toLowerCase().trim();
    
    for (const item of config) {
        // Check if any keyword in the list matches the incoming message
        const matched = item.keywords.some(keyword => message.includes(keyword.toLowerCase()));
        if (matched) {
            return {
                type: item.type,
                reply: item.reply,
                mediaPath: item.mediaPath
            };
        }
    }
    
    return null; // No match found
}

module.exports = { getReply };
