const { MessageEmbed } = require("discord.js");
const Settings = require("../../models/settings");

module.exports = {
    name: "mute",
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_ROLES")) {
            return message.reply("*you don't have permission to mute members.*");
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

        if (!target) {
            const embed = new MessageEmbed()
                .setTitle("mute command")
                .setDescription("*mutes a member so they cannot chat.*")
                .addFields(
                    { name: "```usage```", value: "`,mute @user`", inline: false },
                    { name: "```examples```", value: "`,mute @yusuf`", inline: false }
                );
            return message.reply({ embeds: [embed] });
        }

        // Get mute role from settings
        const settings = await Settings.findOne({ guildId: message.guild.id });
        const roleId = settings?.muteRole;

        if (!roleId) {
            return message.reply("*mute role not set. use `,set mute @role` to configure.*");
        }

        const muteRole = message.guild.roles.cache.get(roleId);
        if (!muteRole) {
            return message.reply("*mute role not found on this server.*");
        }

        if (target.roles.cache.has(roleId)) {
            return message.reply("*this user is already muted.*");
        }

        try {
            await target.roles.add(muteRole);

            const embed = new MessageEmbed()
                .setDescription(`\`successfully muted ${target.user.username}.\``)
                .setFooter({ text: "muted by " + message.author.username + "." })
                .setTimestamp();

            message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            message.reply("*could not mute this user.*");
        }
    },
};
