const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");
const MusicSession = require("../../models/musicSession");
const { players, playSong } = require("./play");

module.exports = {
    name: "skip",
    description: "Skip the current song",
    aliases: ["s", "next"],
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

        // Move to next song
        session.currentIndex++;
        if (session.currentIndex >= session.queue.length) {
            session.currentIndex = 0;
            session.queue = [];
            await session.save();
            player.stop();
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`> ⏭️ <@${message.author.id}>: queue finished.`);
            return message.reply({ embeds: [embed] });
        }

        await session.save();

        const nextSong = session.queue[session.currentIndex];
        const embed = new MessageEmbed()
            .setColor(config.embedColor)
            .setDescription(`> ⏭️ <@${message.author.id}>: skipped. Now playing **${nextSong.title}**`);
        message.reply({ embeds: [embed] });

        // Play next song
        playSong(message.guild.id, client);
    }
};
