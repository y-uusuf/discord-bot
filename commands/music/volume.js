const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");
const MusicSession = require("../../models/musicSession");
const { setVolume } = require("./play");

module.exports = {
    name: "volume",
    description: "Adjust the music volume",
    aliases: ["vol", "v"],
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

        const volume = parseInt(args[0]);

        if (isNaN(volume)) {
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 🔊 <@${message.author.id}>: current volume is **${session.volume}%**.`);
            return message.reply({ embeds: [embed] });
        }

        if (volume < 0 || volume > 100) {
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: volume must be between 0 and 100.`);
            return message.reply({ embeds: [embed] });
        }

        session.volume = volume;
        await session.save();

        // Apply volume dynamically to current playback
        setVolume(message.guild.id, volume);

        const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 🔊 <@${message.author.id}>: volume set to **${volume}%**.`);
        message.reply({ embeds: [embed] });
    }
};
