const { MessageEmbed } = require("discord.js");
const config = require("../config.json");
const Settings = require("../models/settings");

module.exports = {
    name: "messageDelete",
    async execute(message, client) {
        if (!message.guild) return;

        // Check for partials or missing author
        if (message.partial || !message.author) return;

        // Snipe Logic
        if (!message.author.bot) {
            let snipes = client.snipes.get(message.channel.id) || [];

            snipes.unshift({
                content: message.content,
                author: message.author,
                image: message.attachments.first() ? message.attachments.first().proxyURL : null,
                timestamp: Date.now()
            });

            // Keep only the last 5 messages
            if (snipes.length > 5) snipes = snipes.slice(0, 5);

            client.snipes.set(message.channel.id, snipes);
        }

        // Logging Logic
        if (message.author.bot) return;

        const settings = await Settings.findOne({ guildId: message.guild.id });
        if (!settings || !settings.logChannel) return;

        const logChannel = message.guild.channels.cache.get(settings.logChannel);
        if (!logChannel) return;

        const embed = new MessageEmbed()
            .setColor(config.embedColor)
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
            .setDescription(`**Message deleted in <#${message.channel.id}>**\n${message.content || "*No content*"}`)
            .addFields(
                { name: "Author", value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                { name: "Channel", value: `${message.channel} (\`${message.channel.id}\`)`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `ID: ${message.id}` });

        if (message.attachments.size > 0) {
            embed.addFields({ name: "Attachments", value: message.attachments.map(a => `[Link](${a.url})`).join(", ") });
        }

        logChannel.send({ embeds: [embed] }).catch((err) => console.log("Failed to log deleted message:", err));
    }
};
