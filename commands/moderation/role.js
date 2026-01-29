const { MessageEmbed } = require("discord.js");

module.exports = {
    name: "role",
    aliases: ["r"],
    async execute(client, message, args) {
        if (!message.member.permissions.has("ADMINISTRATOR") && message.author.id !== message.guild.ownerId) {
            return message.reply("*sorry, only administrators or the server owner can use this command.*");
        }

        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]?.replace(/[<@&>]/g, ""));

        if (!target || !role) {
            const embed = new MessageEmbed()
                .setTitle("role command")
                .setDescription("*toggle roles on members. adds if they don't have it, removes if they do.*")
                .addFields(
                    { name: "```usage```", value: "`,role @user @role`\n`,r @user @role`", inline: false },
                    { name: "```examples```", value: "`,role @yusuf @Member`\n`,r @yusuf @VIP`", inline: false }
                );
            return message.reply({ embeds: [embed] });
        }

        // Check if bot can manage this role
        if (role.position >= message.guild.me.roles.highest.position) {
            return message.reply("*i can't manage this role, it's higher than or equal to my highest role.*");
        }

        // Check if user can manage this role
        if (message.author.id !== message.guild.ownerId && role.position >= message.member.roles.highest.position) {
            return message.reply("*you can't manage this role, it's higher than or equal to your highest role.*");
        }

        const hasRole = target.roles.cache.has(role.id);

        try {
            if (hasRole) {
                await target.roles.remove(role);
                return message.reply(`*removed **${role.name}** from **${target.user.username}**.*`);
            } else {
                await target.roles.add(role);
                return message.reply(`*added **${role.name}** to **${target.user.username}**.*`);
            }
        } catch (error) {
            console.error(error);
            return message.reply("*sorry, couldn't modify the role.*");
        }
    },
};
