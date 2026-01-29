const TempVoice = require("../models/tempVoice");

module.exports = {
    name: "channelDelete",
    async execute(channel, client) {
        // Check if the deleted channel was a Temp Voice channel
        const tempVoice = await TempVoice.findOne({ channelId: channel.id });

        if (tempVoice) {
            try {
                await TempVoice.deleteOne({ channelId: channel.id });
            } catch (err) {
                console.error(`Failed to delete TempVoice entry for channel ${channel.id}:`, err);
            }
        }
    }
};
