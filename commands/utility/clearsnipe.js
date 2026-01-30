const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");

module.exports = {
    name: "clearsnipe",
    aliases: ["cs"],
    async execute(client, message, args) {
        if (!client.snipes) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`🗑️ <@${message.author.id}>: snipes cleared`);
            return message.reply({ embeds: [embed] });
        }

        
        for (const [channelId, snipes] of client.snipes) {
            const channel = message.guild.channels.cache.get(channelId);
            if (channel) {
                client.snipes.delete(channelId);
            }
        }

        const embed = new MessageEmbed()
            .setColor(config.embedColor).setDescription(`🗑️ <@${message.author.id}>: snipes cleared`);
        return message.reply({ embeds: [embed] });
    },
};
