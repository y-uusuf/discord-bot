const { MessageEmbed } = require("discord.js");
const Settings = require("../../models/settings");

module.exports = {
    name: "unmute",
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_ROLES")) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: you are missing **Manage Roles** permission(s) to run this command`);
            return message.reply({ embeds: [embed] });
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

        if (!target) {
            const embed = new MessageEmbed()
                .setDescription(`🔊 <@${message.author.id}>: unmutes a member.\n\n**usage:** \`,unmute @user\`\n**example:** \`,unmute @yusuf\``);
            return message.reply({ embeds: [embed] });
        }

        // Get mute role from settings
        const settings = await Settings.findOne({ guildId: message.guild.id });
        const roleId = settings?.muteRole;

        if (!roleId) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: mute role not set. use \`,set mute @role\` to configure`);
            return message.reply({ embeds: [embed] });
        }

        const muteRole = message.guild.roles.cache.get(roleId);
        if (!muteRole) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: mute role not found on this server`);
            return message.reply({ embeds: [embed] });
        }

        if (!target.roles.cache.has(roleId)) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: this user is not muted`);
            return message.reply({ embeds: [embed] });
        }

        try {
            await target.roles.remove(muteRole);
            const embed = new MessageEmbed()
                .setDescription(`🔊 <@${message.author.id}>: unmuted **${target.user.username}**`);
            message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: could not unmute this user`);
            message.reply({ embeds: [embed] });
        }
    },
};
