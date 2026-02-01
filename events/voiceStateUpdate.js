const Settings = require("../models/settings");
const TempVoice = require("../models/tempVoice");
const MusicSession = require("../models/musicSession");

module.exports = {
    name: "voiceStateUpdate",
    async execute(oldState, newState, client) {
        const guildSettings = await Settings.findOne({ guildId: newState.guild.id });

        // Music session cleanup - check if session owner left the VC
        if (oldState.channelId && oldState.member) {
            const musicSession = await MusicSession.findOne({ guildId: oldState.guild.id });
            if (musicSession && musicSession.channelId === oldState.channelId) {
                // Check if session owner left
                if (oldState.member.id === musicSession.ownerId && oldState.channelId !== newState.channelId) {
                    try {
                        const { players, connections, resources, idleTimeouts } = require("../commands/music/play");

                        const player = players.get(oldState.guild.id);
                        if (player) {
                            player.stop();
                            players.delete(oldState.guild.id);
                        }

                        const connection = connections.get(oldState.guild.id);
                        if (connection) {
                            connection.destroy();
                            connections.delete(oldState.guild.id);
                        }

                        // Clean up resources and timeouts
                        resources.delete(oldState.guild.id);
                        if (idleTimeouts.has(oldState.guild.id)) {
                            clearTimeout(idleTimeouts.get(oldState.guild.id));
                            idleTimeouts.delete(oldState.guild.id);
                        }

                        await MusicSession.deleteOne({ guildId: oldState.guild.id });

                        // Notify in text channel
                        const textChannel = oldState.guild.channels.cache.get(musicSession.textChannelId);
                        if (textChannel) {
                            const { MessageEmbed } = require("discord.js");
                            const config = require("../config.json");
                            const embed = new MessageEmbed()
                                .setColor(config.embedColor)
                                .setDescription(`> 👋 <@${musicSession.ownerId}> left the voice channel. Music session ended.`);
                            textChannel.send({ embeds: [embed] }).catch(() => { });
                        }
                    } catch (err) {
                        console.error("Music cleanup error:", err);
                    }
                }

                // Check if bot is alone in the channel
                const botChannel = oldState.guild.channels.cache.get(musicSession.channelId);
                if (botChannel && botChannel.members.filter(m => !m.user.bot).size === 0) {
                    try {
                        const { players, connections, resources, idleTimeouts } = require("../commands/music/play");

                        const player = players.get(oldState.guild.id);
                        if (player) {
                            player.stop();
                            players.delete(oldState.guild.id);
                        }

                        const connection = connections.get(oldState.guild.id);
                        if (connection) {
                            connection.destroy();
                            connections.delete(oldState.guild.id);
                        }

                        // Clean up resources and timeouts
                        resources.delete(oldState.guild.id);
                        if (idleTimeouts.has(oldState.guild.id)) {
                            clearTimeout(idleTimeouts.get(oldState.guild.id));
                            idleTimeouts.delete(oldState.guild.id);
                        }

                        await MusicSession.deleteOne({ guildId: oldState.guild.id });
                    } catch (err) {
                        console.error("Music cleanup error:", err);
                    }
                }
            }
        }

        // Deny all auto-kick - immediately kick unauthorized users joining a deny-all channel
        if (newState.channelId && newState.member && !newState.member.user.bot) {
            const joinedChannelId = newState.channelId; // Capture before kicking
            const tempVoice = await TempVoice.findOne({ channelId: joinedChannelId });
            if (tempVoice && tempVoice.denyAll && newState.member.id !== tempVoice.ownerId) {
                // Kick the user immediately
                await newState.setChannel(null).catch(() => { });

                // Send message
                const { MessageEmbed } = require("discord.js");
                const config = require("../config.json");

                // Find a text channel to notify
                const textChannel = newState.guild.channels.cache.find(c =>
                    c.type === 'GUILD_TEXT' && c.permissionsFor(newState.guild.me).has('SEND_MESSAGES')
                );

                if (textChannel) {
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`> ❌ <@${newState.member.id}>: you're not allowed to join <#${joinedChannelId}>.`);
                    textChannel.send({ embeds: [embed] }).catch(() => { });
                }
                return;
            }
        }

        // Join to Create functionality - early return if not configured
        if (!guildSettings?.joinToCreateChannel) return;

        if (newState.channelId === guildSettings.joinToCreateChannel) {
            try {
                const channel = await newState.guild.channels.create(`${newState.member.displayName}'s vc.`, {
                    type: "GUILD_VOICE",
                    parent: newState.channel.parent,
                    permissionOverwrites: [
                        {
                            id: newState.guild.id,
                            allow: ["VIEW_CHANNEL"],
                        },
                        {
                            id: newState.member.id,
                            allow: ["VIEW_CHANNEL", "CONNECT", "MANAGE_CHANNELS", "MOVE_MEMBERS"],
                        },
                    ],
                });

                await newState.setChannel(channel);

                await new TempVoice({
                    ownerId: newState.member.id,
                    channelId: channel.id,
                    guildId: newState.guild.id,
                }).save();

            } catch (err) {
                console.error("J2C Error:", err);
            }
        }

        // Temp voice cleanup - only check if user left a channel
        if (oldState.channelId && oldState.channelId !== guildSettings.joinToCreateChannel) {
            const channel = oldState.guild.channels.cache.get(oldState.channelId);
            if (channel && channel.members.size === 0) {
                const tempVoice = await TempVoice.findOne({ channelId: oldState.channelId });
                if (tempVoice) {
                    await channel.delete().catch(() => { });
                    await TempVoice.deleteOne({ channelId: oldState.channelId });
                }
            }
        }
    }
};
