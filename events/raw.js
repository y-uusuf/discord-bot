const TempVoice = require("../models/tempVoice");
const { MessageEmbed } = require("discord.js");

module.exports = {
    name: "raw",
    async execute(packet, ...args) {
        // The 'raw' event in DJS v13 passes (packet, shardId).
        // eventHandler.js appends 'client' at the end.
        // So args contains [shardId, client] (usually).
        // We retrieve client from the last argument to be safe.
        const client = args[args.length - 1];

        // We only care about INTERACTION_CREATE
        if (packet.t !== "INTERACTION_CREATE") return;

        const interaction = packet.d;

        // Ensure it's a Component Interaction
        // We rely on custom_id to catch our User Select interactions
        if (interaction.type !== 3 || !interaction.data) return;

        const customId = interaction.data.custom_id;
        if (!customId || !customId.startsWith("vc_select_")) return;

        const action = customId.replace("vc_select_", "");
        const targetId = interaction.data.values ? interaction.data.values[0] : null;

        if (!targetId) return;

        // Basic Info
        const userId = interaction.member ? interaction.member.user.id : interaction.user.id;
        const guildId = interaction.guild_id;

        // Helper to Respond via client.api
        const respond = async (type, data) => {
            try {
                if (!client.api) {
                    console.error("Client API not available");
                    return;
                }
                await client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: type,
                        data: data
                    }
                });
            } catch (err) {
                console.error("Failed to respond to raw interaction:", err);
            }
        };

        if (!client.guilds) {
            console.error("Client guilds cache not available. Client object might be malformed.", client);
            return;
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        // Verify Ownership
        const tempVoice = await TempVoice.findOne({ ownerId: userId });
        if (!tempVoice) {
            return respond(4, {
                embeds: [new MessageEmbed().setDescription(`❌ <@${userId}>: you don't own a temporary voice channel.`).toJSON()],
                flags: 64
            });
        }

        const channel = guild.channels.cache.get(tempVoice.channelId);
        if (!channel) {
            await TempVoice.deleteOne({ ownerId: userId });
            return respond(4, {
                embeds: [new MessageEmbed().setDescription(`❌ <@${userId}>: your channel no longer exists.`).toJSON()],
                flags: 64
            });
        }

        try {
            if (action === "ban") {
                await channel.permissionOverwrites.edit(targetId, { CONNECT: false });
                if (!tempVoice.bannedUsers.includes(targetId)) tempVoice.bannedUsers.push(targetId);

                const member = guild.members.cache.get(targetId);
                if (member && member.voice.channelId === channel.id) await member.voice.setChannel(null);

                await tempVoice.save();
                const embed = new MessageEmbed().setDescription(`> 🚫 <@${userId}>: banned <@${targetId}>.`).toJSON();
                // Type 7 = Update Message (removes dropdown, shows result)
                await respond(7, { embeds: [embed], components: [] });
            }
            else if (action === "kick") {
                const member = guild.members.cache.get(targetId);
                if (member && member.voice.channelId === channel.id) {
                    await member.voice.setChannel(null);
                    const embed = new MessageEmbed().setDescription(`> 👢 <@${userId}>: kicked <@${targetId}>.`).toJSON();
                    await respond(7, { embeds: [embed], components: [] });
                } else {
                    const embed = new MessageEmbed().setDescription(`❌ <@${userId}>: user <@${targetId}> is not in the voice channel.`).toJSON();
                    await respond(7, { embeds: [embed], components: [] });
                }
            }
            else if (action === "trust") {
                await channel.permissionOverwrites.edit(targetId, { CONNECT: true });
                if (!tempVoice.allowedUsers.includes(targetId)) tempVoice.allowedUsers.push(targetId);
                await tempVoice.save();
                const embed = new MessageEmbed().setDescription(`> ➕ <@${userId}>: trusted <@${targetId}>.`).toJSON();
                await respond(7, { embeds: [embed], components: [] });
            }
            else if (action === "transfer") {
                await channel.permissionOverwrites.edit(targetId, { MANAGE_CHANNELS: true, MOVE_MEMBERS: true, CONNECT: true });
                await channel.permissionOverwrites.edit(userId, { MANAGE_CHANNELS: null, MOVE_MEMBERS: null });

                tempVoice.ownerId = targetId;
                await tempVoice.save();
                const embed = new MessageEmbed().setDescription(`> 🔁 <@${userId}>: transferred ownership to <@${targetId}>.`).toJSON();
                await respond(7, { embeds: [embed], components: [] });
            }
            else if (action === "untrust") {
                if (tempVoice.allowedUsers.includes(targetId)) {
                    await channel.permissionOverwrites.delete(targetId);
                    tempVoice.allowedUsers = tempVoice.allowedUsers.filter(id => id !== targetId);
                    await tempVoice.save();
                    const embed = new MessageEmbed().setDescription(`> ➖ <@${userId}>: untrusted <@${targetId}>.`).toJSON();
                    await respond(7, { embeds: [embed], components: [] });
                } else {
                    const embed = new MessageEmbed().setDescription(`❌ <@${userId}>: <@${targetId}> is not trusted.`).toJSON();
                    await respond(7, { embeds: [embed], components: [] });
                }
            }
            else if (action === "unban") {
                if (tempVoice.bannedUsers.includes(targetId)) {
                    await channel.permissionOverwrites.delete(targetId);
                    tempVoice.bannedUsers = tempVoice.bannedUsers.filter(id => id !== targetId);
                    await tempVoice.save();
                    const embed = new MessageEmbed().setDescription(`> 🕊️ <@${userId}>: unbanned <@${targetId}>.`).toJSON();
                    await respond(7, { embeds: [embed], components: [] });
                } else {
                    const embed = new MessageEmbed().setDescription(`❌ <@${userId}>: <@${targetId}> is not banned.`).toJSON();
                    await respond(7, { embeds: [embed], components: [] });
                }
            }
        } catch (err) {
            console.error(err);
            respond(4, { content: `❌ Failed to perform action.`, flags: 64 });
        }
    }
};
