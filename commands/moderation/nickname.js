const { MessageEmbed } = require("discord.js");

module.exports = {
    name: "nickname",
    aliases: ["nick"],
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_NICKNAMES")) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: you are missing **Manage Nicknames** permission(s) to run this command`);
            return message.reply({ embeds: [embed] });
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        const nickname = args.slice(target ? 1 : 0).join(" ");

        if (!target && !nickname) {
            const embed = new MessageEmbed()
                .setDescription(`📝 <@${message.author.id}>: change a member's nickname.\n\n**usage:** \`,nick @user <nickname>\` or \`,nick @user\` to reset`);
            return message.reply({ embeds: [embed] });
        }

        // If no target mentioned, change self nickname
        const memberToChange = target || message.member;
        const newNick = target ? nickname : args.join(" ");

        // Check if bot can change this member's nickname
        if (memberToChange.roles.highest.position >= message.guild.me.roles.highest.position && memberToChange.id !== message.guild.me.id) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: i can't change this user's nickname, their role is higher than mine`);
            return message.reply({ embeds: [embed] });
        }

        // Check if user can change this member's nickname
        if (memberToChange.id !== message.member.id && memberToChange.roles.highest.position >= message.member.roles.highest.position && message.author.id !== message.guild.ownerId) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: you can't change this user's nickname, their role is higher than yours`);
            return message.reply({ embeds: [embed] });
        }

        try {
            const oldNick = memberToChange.nickname || memberToChange.user.username;

            if (!newNick || newNick === "") {
                // Reset nickname
                await memberToChange.setNickname(null);
                const embed = new MessageEmbed()
                    .setDescription(`📝 <@${message.author.id}>: reset **${memberToChange.user.username}**'s nickname`);
                return message.reply({ embeds: [embed] });
            } else {
                // Set new nickname
                await memberToChange.setNickname(newNick);
                const embed = new MessageEmbed()
                    .setDescription(`📝 <@${message.author.id}>: changed **${memberToChange.user.username}**'s nickname to **${newNick}**`);
                return message.reply({ embeds: [embed] });
            }
        } catch (error) {
            console.error(error);
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: couldn't change the nickname`);
            return message.reply({ embeds: [embed] });
        }
    },
};
