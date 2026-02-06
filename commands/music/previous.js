const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");
const MusicSession = require("../../models/musicSession");
const { players, playSong } = require("./play");

module.exports = {
    name: "previous",
    description: "Play the previous song",
    aliases: ["back", "rev"],
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

        const player = players.get(message.guild.id);
        if (!player) {
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: no music is currently playing.`);
            return message.reply({ embeds: [embed] });
        }

        // Move to previous song
        if (session.currentIndex <= 0) {
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: no previous song to play.`);
            return message.reply({ embeds: [embed] });
        }

        session.currentIndex--;
        await session.save();

        // React and play previous song
        message.react("👍");
        playSong(message.guild.id, client);
    }
};
