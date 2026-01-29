const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    muteRole: { type: String, default: null },
    jailRole: { type: String, default: null },
    // modRole removed
    flaggedWords: { type: [String], default: [] },
    flagLogPing: { type: String, default: null },
    savedWebhooks: { type: Map, of: String, default: {} },
    logChannel: { type: String, default: null },
    welcomeChannel: { type: String, default: null },
    leaveChannel: { type: String, default: null },
    countingChannel: { type: String, default: null },
    confessChannel: { type: String, default: null },
    trialChannel: { type: String, default: null },
    trialRole: { type: String, default: null },
    levelChannel: { type: String, default: null },
    autoReacts: { type: Map, of: String, default: {} },
    joinToCreateChannel: { type: String, default: null },
    prefix: { type: String, default: null }
});

module.exports = mongoose.model('Settings', settingsSchema);
