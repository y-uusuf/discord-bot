const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
    title: String,
    url: String,
    duration: String,
    thumbnail: String,
    channel: String
});

const musicSessionSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    channelId: { type: String, required: true },
    textChannelId: { type: String, required: true },
    queue: { type: [songSchema], default: [] },
    currentIndex: { type: Number, default: 0 },
    volume: { type: Number, default: 100 },
    isPaused: { type: Boolean, default: false },
    loop: { type: String, enum: ['none', 'song', 'queue'], default: 'none' }
});

module.exports = mongoose.model('MusicSession', musicSessionSchema);
