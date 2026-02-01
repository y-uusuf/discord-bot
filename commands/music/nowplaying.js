const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");
const MusicSession = require("../../models/musicSession");

module.exports = {
    name: "nowplaying",
    description: "Show the currently playing song",
    aliases: ["np", "current"],
    async execute(client, message, args) {
        const session = await MusicSession.findOne({ guildId: message.guild.id });

        if (!session || session.queue.length === 0) {
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: no music is currently playing.`);
            return message.reply({ embeds: [embed] });
        }

        const song = session.queue[session.currentIndex];
        if (!song) {
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: no music is currently playing.`);
            return message.reply({ embeds: [embed] });
        }

        const statusEmoji = session.isPaused ? "⏸️" : "▶️";
        const loopText = session.loop === 'none' ? '' : ` • Loop: ${session.loop}`;

        const embed = new MessageEmbed()
            .setColor(config.embedColor)
            .setThumbnail(song.thumbnail)
            .setDescription(`> ${statusEmoji} **Now Playing**\n\n**${song.title}**\nChannel: **${song.channel}**\nDuration: **${song.duration}**${loopText}`)
            .setFooter({ text: `Requested by ${message.guild.members.cache.get(session.ownerId)?.displayName || "Unknown"} • Volume: ${session.volume}%` });

        message.reply({ embeds: [embed] });
    }
};
