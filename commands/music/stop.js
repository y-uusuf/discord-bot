const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");
const MusicSession = require("../../models/musicSession");
const { players, connections, ffmpegProcesses } = require("./play");

module.exports = {
    name: "stop",
    description: "Stop playing and disconnect from voice channel",
    aliases: ["dc", "disconnect", "leave"],
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

        // Stop player first
        const player = players.get(message.guild.id);
        if (player) {
            player.stop();
            players.delete(message.guild.id);
        }

        // Kill FFmpeg process
        if (ffmpegProcesses.has(message.guild.id)) {
            const process = ffmpegProcesses.get(message.guild.id);
            process.kill('SIGKILL');
            ffmpegProcesses.delete(message.guild.id);
        }

        // Disconnect
        const connection = connections.get(message.guild.id);
        if (connection) {
            connection.destroy();
            connections.delete(message.guild.id);
        }

        // Delete session
        await MusicSession.deleteOne({ guildId: message.guild.id });

        message.react("👍");
    }
};
