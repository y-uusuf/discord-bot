const { MessageEmbed } = require("discord.js");

module.exports = {
    name: "clearsnipe",
    aliases: ["cs"],
    async execute(client, message, args) {
        if (!client.snipes) {
            const embed = new MessageEmbed()
                .setDescription(`🗑️ <@${message.author.id}>: snipes cleared`);
            return message.reply({ embeds: [embed] });
        }

        // Clear all snipes for this guild
        for (const [channelId, snipes] of client.snipes) {
            const channel = message.guild.channels.cache.get(channelId);
            if (channel) {
                client.snipes.delete(channelId);
            }
        }

        const embed = new MessageEmbed()
            .setDescription(`🗑️ <@${message.author.id}>: snipes cleared`);
        return message.reply({ embeds: [embed] });
    },
};
