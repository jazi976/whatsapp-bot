const mongoose = require('mongoose');

const UserSessionSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    state: { type: String, default: 'NEW' },
    language: { type: String, default: 'en' }, // 'en', 'manglish', 'ml'
    chatHistory: [{ role: String, content: String }],
    updatedAt: { type: Date, default: Date.now }
});

UserSessionSchema.pre('save', function () {
    this.updatedAt = new Date();
});

module.exports = mongoose.model('UserSession', UserSessionSchema);
