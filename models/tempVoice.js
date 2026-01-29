const mongoose = require('mongoose');

const tempVoiceSchema = new mongoose.Schema({
    ownerId: { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    locked: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    limit: { type: Number, default: 0 }, // 0 = unlimited
    allowedUsers: { type: [String], default: [] }, // Trusted users
    bannedUsers: { type: [String], default: [] }   // Banned users
});

module.exports = mongoose.model('TempVoice', tempVoiceSchema);
