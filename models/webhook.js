const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    msgLog: {
        id: { type: String, default: null },
        token: { type: String, default: null }
    },
    welcome: {
        id: { type: String, default: null },
        token: { type: String, default: null }
    },
    leave: {
        id: { type: String, default: null },
        token: { type: String, default: null }
    }
});

module.exports = mongoose.model('Webhook', webhookSchema);
