const { MessageEmbed } = require("discord.js");
const Settings = require("../../models/settings");

module.exports = {
    name: "unmute",
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_ROLES")) {
            return message.reply("*you don't have permission to unmute members.*");
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

        if (!target) {
            const embed = new MessageEmbed()
                .setTitle("unmute command")
                .setDescription("*unmutes a member.*")
                .addFields(
                    { name: "```usage```", value: "`,unmute @user`", inline: false },
                    { name: "```examples```", value: "`,unmute @yusuf`", inline: false }
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

        if (!target.roles.cache.has(roleId)) {
            return message.reply("*this user is not muted.*");
        }

        try {
            await target.roles.remove(muteRole);

            const embed = new MessageEmbed()
                .setDescription(`\`successfully unmuted ${target.user.username}.\``)
                .setFooter({ text: "unmuted by " + message.author.username + "." })
                .setTimestamp();

            message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            message.reply("*could not unmute this user.*");
        }
    },
};
