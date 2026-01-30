const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");
const TempVoice = require("../../models/tempVoice");

module.exports = {
    name: "vc",
    description: "Manage your temporary voice channel",
    async execute(client, message, args) {
        const action = args[0]?.toLowerCase();

        if (!action) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`🎤 <@${message.author.id}>: manage your temp voice channel.\n\n**usage:** \`,vc <action> [value]\`\n**example:** \`,vc name Chill Zone\`\n\n**actions:** name, limit, lock, unlock, trust, untrust, kick, ban, unban, claim, transfer, invite, delete`);
            return message.reply({ embeds: [embed] });
        }

        if (action === "claim") {
            const currentChannel = message.member.voice.channel;
            if (!currentChannel) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you must be in a voice channel to claim it`);
                return message.reply({ embeds: [embed] });
            }

            const tempVoice = await TempVoice.findOne({ channelId: currentChannel.id });
            if (!tempVoice) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: this is not a temporary voice channel`);
                return message.reply({ embeds: [embed] });
            }

            if (currentChannel.members.has(tempVoice.ownerId)) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: the owner is still in the channel`);
                return message.reply({ embeds: [embed] });
            }

            tempVoice.ownerId = message.author.id;
            await tempVoice.save();

            await currentChannel.permissionOverwrites.edit(message.author.id, {
                MANAGE_CHANNELS: true,
                MOVE_MEMBERS: true,
                CONNECT: true
            });

            return message.react("👍");
        }

        const tempVoice = await TempVoice.findOne({ ownerId: message.author.id });
        if (!tempVoice) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you don't own a temporary voice channel`);
            return message.reply({ embeds: [embed] });
        }

        const channel = message.guild.channels.cache.get(tempVoice.channelId);
        if (!channel) {
            await TempVoice.deleteOne({ ownerId: message.author.id });
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: your channel no longer exists`);
            return message.reply({ embeds: [embed] });
        }

        try {
            switch (action) {
                case "name":
                    const newName = args.slice(1).join(" ");
                    if (!newName) {
                        const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please provide a new name`);
                        return message.reply({ embeds: [embed] });
                    }
                    await channel.setName(newName);
                    message.react("👍");
                    break;

                case "limit":
                    const limit = parseInt(args[1]);
                    if (isNaN(limit) || limit < 0 || limit > 99) {
                        const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please provide a valid number (0-99)`);
                        return message.reply({ embeds: [embed] });
                    }
                    await channel.setUserLimit(limit);
                    tempVoice.limit = limit;
                    await tempVoice.save();
                    message.react("👍");
                    break;

                case "lock":
                    await channel.permissionOverwrites.edit(message.guild.id, { CONNECT: false });
                    tempVoice.locked = true;
                    await tempVoice.save();
                    message.react("👍");
                    break;

                case "unlock":
                    await channel.permissionOverwrites.edit(message.guild.id, { CONNECT: null });
                    tempVoice.locked = false;
                    await tempVoice.save();
                    message.react("👍");
                    break;

                case "trust":
                    const userToTrust = message.mentions.users.first() || client.users.cache.get(args[1]);
                    if (!userToTrust) {
                        const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please mention a user`);
                        return message.reply({ embeds: [embed] });
                    }
                    await channel.permissionOverwrites.edit(userToTrust.id, { CONNECT: true });
                    tempVoice.allowedUsers.push(userToTrust.id);
                    await tempVoice.save();
                    message.react("👍");
                    break;

                case "untrust":
                    const userToUntrust = message.mentions.users.first() || client.users.cache.get(args[1]);
                    if (!userToUntrust) {
                        const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please mention a user`);
                        return message.reply({ embeds: [embed] });
                    }
                    await channel.permissionOverwrites.delete(userToUntrust.id);
                    tempVoice.allowedUsers = tempVoice.allowedUsers.filter(id => id !== userToUntrust.id);
                    await tempVoice.save();
                    message.react("👍");
                    break;

                case "kick":
                    const userToKick = message.mentions.users.first() || client.users.cache.get(args[1]);
                    if (!userToKick) {
                        const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please mention a user`);
                        return message.reply({ embeds: [embed] });
                    }
                    const memberToKick = channel.members.get(userToKick.id);
                    if (memberToKick) {
                        await memberToKick.voice.setChannel(null);
                        message.react("👍");
                    } else {
                        const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: user is not in your channel`);
                        message.reply({ embeds: [embed] });
                    }
                    break;

                case "ban":
                    const userToBan = message.mentions.users.first() || client.users.cache.get(args[1]);
                    if (!userToBan) {
                        const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please mention a user`);
                        return message.reply({ embeds: [embed] });
                    }
                    await channel.permissionOverwrites.edit(userToBan.id, { CONNECT: false });
                    tempVoice.bannedUsers.push(userToBan.id);
                    const memberToBan = channel.members.get(userToBan.id);
                    if (memberToBan) await memberToBan.voice.setChannel(null);
                    await tempVoice.save();
                    message.react("👍");
                    break;

                case "unban":
                    const userToUnban = message.mentions.users.first() || client.users.cache.get(args[1]);
                    if (!userToUnban) {
                        const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please mention a user`);
                        return message.reply({ embeds: [embed] });
                    }
                    await channel.permissionOverwrites.delete(userToUnban.id);
                    tempVoice.bannedUsers = tempVoice.bannedUsers.filter(id => id !== userToUnban.id);
                    await tempVoice.save();
                    message.react("👍");
                    break;

                case "transfer":
                    const newOwner = message.mentions.users.first() || client.users.cache.get(args[1]);
                    if (!newOwner) {
                        const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please mention a user`);
                        return message.reply({ embeds: [embed] });
                    }
                    await channel.permissionOverwrites.edit(newOwner.id, { MANAGE_CHANNELS: true, MOVE_MEMBERS: true, CONNECT: true });
                    await channel.permissionOverwrites.edit(message.author.id, { MANAGE_CHANNELS: null, MOVE_MEMBERS: null });
                    tempVoice.ownerId = newOwner.id;
                    await tempVoice.save();
                    message.react("👍");
                    break;

                case "delete":
                    await message.react("👍");
                    await channel.delete();
                    break;

                case "invite":
                    const invite = await channel.createInvite({ maxAge: 300, maxUses: 1 });
                    message.author.send(`Here is an invite to your channel: ${invite.url}`).catch(() => {
                        const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 🗣️ <@${message.author.id}>: created invite: ${invite.url}`);
                        message.reply({ embeds: [embed] });
                    });

                    if (message.guild) {
                        message.react("👍");
                    }
                    break;

                default:
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: unknown action. use \`,vc\` for help`);
                    message.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error(error);
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: failed to execute action`);
            message.reply({ embeds: [embed] });
        }
    }
};
