const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");
const MusicSession = require("../../models/musicSession");
const { players } = require("./play");

module.exports = {
    name: "queue",
    description: "Show or manage the current music queue",
    aliases: ["q"],
    async execute(client, message, args) {
        const session = await MusicSession.findOne({ guildId: message.guild.id });

        const subCommand = args[0]?.toLowerCase();

        // Handle subcommands
        if (subCommand === "clear" || subCommand === "remove") {
            if (!session || session.queue.length === 0) {
                const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: the queue is empty.`);
                return message.reply({ embeds: [embed] });
            }

            // Check ownership
            const isAdmin = message.member.permissions.has("ADMINISTRATOR");
            if (session.ownerId !== message.author.id && !isAdmin) {
                const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: only <@${session.ownerId}> or admins can manage the queue.`);
                return message.reply({ embeds: [embed] });
            }

            const position = parseInt(args[1]);

            // Clear specific song by number
            if (!isNaN(position)) {
                if (position < 1 || position > session.queue.length) {
                    const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: invalid position. Queue has ${session.queue.length} songs.`);
                    return message.reply({ embeds: [embed] });
                }

                // Can't remove currently playing song
                if (position - 1 === session.currentIndex) {
                    const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: can't remove the currently playing song. Use \`,skip\` instead.`);
                    return message.reply({ embeds: [embed] });
                }

                const removed = session.queue.splice(position - 1, 1)[0];

                // Adjust currentIndex if needed
                if (position - 1 < session.currentIndex) {
                    session.currentIndex--;
                }

                await session.save();

                const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 🗑️ <@${message.author.id}>: removed **${removed.title}** from queue.`);
                return message.reply({ embeds: [embed] });
            }

            // Clear entire queue (except current song)
            const currentSong = session.queue[session.currentIndex];
            session.queue = currentSong ? [currentSong] : [];
            session.currentIndex = 0;
            await session.save();

            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 🗑️ <@${message.author.id}>: cleared the queue.`);
            return message.reply({ embeds: [embed] });
        }

        // Show queue
        if (!session || session.queue.length === 0) {
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: the queue is empty.`);
            return message.reply({ embeds: [embed] });
        }

        const page = parseInt(args[0]) || 1;
        const itemsPerPage = 10;
        const totalPages = Math.ceil(session.queue.length / itemsPerPage);
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;

        const queueSlice = session.queue.slice(start, end);

        let queueText = queueSlice.map((song, index) => {
            const position = start + index + 1;
            const prefix = (start + index) === session.currentIndex ? "▶️" : `**${position}.**`;
            return `${prefix} ${song.title} (${song.duration})`;
        }).join("\n");

        const embed = new MessageEmbed()
            .setColor(config.embedColor)
            .setDescription(`> 📜 **Queue** (${session.queue.length} songs)\n\n${queueText}`)
            .setFooter({ text: `Page ${page}/${totalPages} • ,q clear | ,q remove <#> • Owner: ${message.guild.members.cache.get(session.ownerId)?.displayName || "Unknown"}` });

        message.reply({ embeds: [embed] });
    }
};
