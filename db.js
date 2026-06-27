const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    state:       { type: String, default: 'NEW' },
    language:    { type: String, default: 'en' },
    chatHistory: { type: Array,  default: [] },
}, { timestamps: true });

module.exports = mongoose.model('UserSession', userSessionSchema);
