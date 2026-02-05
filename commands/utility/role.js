const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");

module.exports = {
    name: "role",
    aliases: ["r"],
    async execute(client, message, args) {
        if (!message.member.permissions.has("ADMINISTRATOR") && message.author.id !== message.guild.ownerId) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you are missing **Administrator** permission(s) to run this command`);
            return message.reply({ embeds: [embed] });
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]?.replace(/[<@&>]/g, ""));

        if (!target || !role) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`🏷️ <@${message.author.id}>: toggle roles on members.\n\n**usage:** \`,role @user @role\`\n**example:** \`,role @yusuf @Member\``);
            return message.reply({ embeds: [embed] });
        }

        
        if (role.position >= message.guild.me.roles.highest.position) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: i can't manage this role, it's higher than my highest role`);
            return message.reply({ embeds: [embed] });
        }

        
        if (message.author.id !== message.guild.ownerId && role.position >= message.member.roles.highest.position) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you can't manage this role, it's higher than your highest role`);
            return message.reply({ embeds: [embed] });
        }

        const hasRole = target.roles.cache.has(role.id);

        try {
            if (hasRole) {
                await target.roles.remove(role);
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`🏷️ <@${message.author.id}>: removed **${role.name}** from **${target.user.username}**`);
                return message.reply({ embeds: [embed] });
            } else {
                await target.roles.add(role);
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`🏷️ <@${message.author.id}>: added **${role.name}** to **${target.user.username}**`);
                return message.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error(error);
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: couldn't modify the role`);
            return message.reply({ embeds: [embed] });
        }
    },
};
