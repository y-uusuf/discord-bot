const mongoose = require("mongoose");

const afkSchema = new mongoose.Schema({
  userID: { type: String, required: true, unique: true },
  reason: { type: String, default: "AFK" },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AFK", afkSchema);
