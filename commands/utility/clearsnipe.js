const { MessageEmbed } = require("discord.js");

module.exports = {
    name: "clearsnipe",
    aliases: ["cs"],
    async execute(client, message, args) {
        if (!client.snipes) {
            return message.react("✅");
        }

        // Clear all snipes for this guild
        for (const [channelId, snipes] of client.snipes) {
            const channel = message.guild.channels.cache.get(channelId);
            if (channel) {
                client.snipes.delete(channelId);
            }
        }

        return message.react("✅");
    },
};

