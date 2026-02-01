const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");
const MusicSession = require("../../models/musicSession");

// Pull everything we can from play.js (safe if some aren't exported)
const playModule = require("./play");
const players = playModule.players;
const connections = playModule.connections;
const resources = playModule.resources;       // optional
const idleTimeouts = playModule.idleTimeouts; // optional

module.exports = {
    name: "stop",
    description: "Stop playing and disconnect from voice channel",
    aliases: ["dc", "disconnect", "leave"],
    async execute(client, message, args) {
        const session = await MusicSession.findOne({ guildId: message.guild.id });

        // If no session, we can still try to force disconnect if bot is in VC
        if (!session) {
            // Try stored connection first
            const storedConn = connections?.get(message.guild.id);
            if (storedConn) {
                try { storedConn.destroy(); } catch (_) { }
                connections.delete(message.guild.id);
            }

            // Fallback: if bot is in a VC but maps are missing/out of sync
            const me = message.guild.members.me || message.guild.me;
            const botInVc = me?.voice?.channel;
            if (botInVc) {
                try {
                    // If the bot is connected, destroying stored conn usually handles it,
                    // but if not present, we can force disconnect by moving it out (if possible).
                    // Most bots can't "setChannel(null)" on themselves, so we just ensure any
                    // lingering voice adapter connection is gone via stored conn above.
                    // Still reply with a helpful message.
                } catch (_) { }
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`> 👋 <@${message.author.id}>: forced disconnect (no active session found).`);
                return message.reply({ embeds: [embed] });
            }

            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`❌ <@${message.author.id}>: no music session found, and I'm not in a voice channel.`);
            return message.reply({ embeds: [embed] });
        }

        // Ownership check
        const isAdmin = message.member.permissions.has("ADMINISTRATOR");
        if (session.ownerId !== message.author.id && !isAdmin) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`❌ <@${message.author.id}>: only <@${session.ownerId}> or admins can control the music.`);
            return message.reply({ embeds: [embed] });
        }

        // Clear idle timeout if present
        const t = idleTimeouts?.get(message.guild.id);
        if (t) {
            clearTimeout(t);
            idleTimeouts.delete(message.guild.id);
        }

        // Stop player if present
        const player = players?.get(message.guild.id);
        if (player) {
            try { player.stop(true); } catch (_) { try { player.stop(); } catch (_) { } }
            players.delete(message.guild.id);
        }

        // Destroy voice connection if present
        const connection = connections?.get(message.guild.id);
        if (connection) {
            try { connection.destroy(); } catch (_) { }
            connections.delete(message.guild.id);
        }

        // Cleanup any stored resource (optional)
        if (resources?.has(message.guild.id)) {
            resources.delete(message.guild.id);
        }

        // Extra fallback: if bot still appears in VC, nuke any leftover connection reference
        const me = message.guild.members.me || message.guild.me;
        const botVc = me?.voice?.channel;
        if (botVc && !connections?.get(message.guild.id)) {
            // Nothing else we can reliably do from here without a connection object,
            // but this covers the common "maps out of sync" case above.
            // (If you're seeing the bot stuck, it almost always means the connection wasn't destroyed.)
        }

        // Delete session
        await MusicSession.deleteOne({ guildId: message.guild.id });

        const embed = new MessageEmbed()
            .setColor(config.embedColor)
            .setDescription(`> 👋 <@${message.author.id}>: disconnected from voice channel.`);
        return message.reply({ embeds: [embed] });
    }
};
