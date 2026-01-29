const Settings = require("../models/settings");
const TempVoice = require("../models/tempVoice");

module.exports = {
    name: "voiceStateUpdate",
    async execute(oldState, newState, client) {
        const guildSettings = await Settings.findOne({ guildId: newState.guild.id });
        if (!guildSettings?.joinToCreateChannel) return;

        // JOIN TO CREATE
        if (newState.channelId === guildSettings.joinToCreateChannel) {
            try {
                // Create new VC
                const channel = await newState.guild.channels.create(`${newState.member.displayName}'s vc.`, {
                    type: "GUILD_VOICE",
                    parent: newState.channel.parent,
                    permissionOverwrites: [
                        {
                            id: newState.guild.id, // @everyone
                            allow: ["VIEW_CHANNEL"],
                        },
                        {
                            id: newState.member.id,
                            allow: ["VIEW_CHANNEL", "CONNECT", "MANAGE_CHANNELS", "MOVE_MEMBERS"],
                        },
                    ],
                });

                // Move member
                await newState.setChannel(channel);

                // Save to DB
                await new TempVoice({
                    ownerId: newState.member.id,
                    channelId: channel.id,
                    guildId: newState.guild.id,
                }).save();

            } catch (err) {
                console.error("J2C Error:", err);
            }
        }

        // DELETE EMPTY TEMP CHANNELS
        if (oldState.channelId && oldState.channelId !== guildSettings.joinToCreateChannel) {
            const tempVoice = await TempVoice.findOne({ channelId: oldState.channelId });
            if (tempVoice) {
                const channel = oldState.guild.channels.cache.get(oldState.channelId);
                if (channel && channel.members.size === 0) {
                    await channel.delete().catch(() => { });
                    await TempVoice.deleteOne({ channelId: oldState.channelId });
                }
            }
        }
    }
};
