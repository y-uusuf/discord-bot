const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");
const MusicSession = require("../../models/musicSession");

module.exports = {
    name: "repeat",
    description: "Toggle repeat mode for the current song",
    aliases: ["loop", "rp"],
    async execute(client, message, args) {
        const session = await MusicSession.findOne({ guildId: message.guild.id });

        if (!session) {
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: no music is currently playing.`);
            return message.reply({ embeds: [embed] });
        }

        // Check ownership
        const isAdmin = message.member.permissions.has("ADMINISTRATOR");
        if (session.ownerId !== message.author.id && !isAdmin) {
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: only <@${session.ownerId}> or admins can control the music.`);
            return message.reply({ embeds: [embed] });
        }

        // Toggle between 'none' and 'song' loop modes
        if (session.loop === 'song') {
            session.loop = 'none';
            await session.save();
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 🔁 <@${message.author.id}>: repeat **disabled**.`);
            return message.reply({ embeds: [embed] });
        } else {
            session.loop = 'song';
            await session.save();
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 🔂 <@${message.author.id}>: now repeating the current song.`);
            return message.reply({ embeds: [embed] });
        }
    }
};
