const mongoose = require('mongoose');

const countSchema = new mongoose.Schema({
    channelId: String,
    currentNumber: Number,
    lastUserId: String
});

module.exports = mongoose.model('Count', countSchema);
