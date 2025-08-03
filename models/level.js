const mongoose = require('mongoose');

const levelSchema = new mongoose.Schema({
  userID: { type: String, required: true, unique: true },
  level: { type: Number, default: 1 },
  messages: { type: Number, default: 0 },
  aura: { type: Number, default: 0 },

});

module.exports = mongoose.model('Level', levelSchema);
