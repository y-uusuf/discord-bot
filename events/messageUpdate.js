const { MessageEmbed } = require("discord.js");
const config = require("../config.json");
const Settings = require("../models/settings");

module.exports = {
    name: "messageUpdate",
    async execute(oldMessage, newMessage, client) {
        if (!oldMessage.guild || oldMessage.partial || !oldMessage.author || oldMessage.author.bot) return;

        // Ignore if content is the same (e.g. embed updates)
        if (oldMessage.content === newMessage.content) return;

        const settings = await Settings.findOne({ guildId: oldMessage.guild.id });
        if (!settings || !settings.logChannel) return;

        const logChannel = oldMessage.guild.channels.cache.get(settings.logChannel);
        if (!logChannel) return;

        const embed = new MessageEmbed()
            .setColor(config.embedColor)
            .setAuthor({ name: newMessage.author.tag, iconURL: newMessage.author.displayAvatarURL({ dynamic: true }) })
            .setDescription(`**Message edited in <#${oldMessage.channel.id}>** [Jump to Message](${newMessage.url})`)
            .addFields(
                { name: "Before", value: oldMessage.content || "*No content*" },
                { name: "After", value: newMessage.content || "*No content*" }
            )
            .setTimestamp()
            .setFooter({ text: `ID: ${newMessage.id}` });

        logChannel.send({ embeds: [embed] }).catch((err) => console.log("Failed to log edited message:", err));
    }
};
