const { MessageEmbed } = require("discord.js");

module.exports = {
    name: "kick",
    async execute(client, message, args) {
        if (!message.member.permissions.has("KICK_MEMBERS")) {
            return message.reply("*sorry, you can't kick anyone.*");
        }

        const targetIdOrMention = args[0];
        const reason = args.slice(1).join(" ") || "n/a";

        if (!targetIdOrMention) {
            const embed = new MessageEmbed()
                .setTitle("kick command")
                .setDescription("*kicks a member from the server.*")
                .addFields(
                    { name: "```usage```", value: "`,kick @user [reason]`", inline: false },
                    { name: "```examples```", value: "`,kick @yusuf spamming`", inline: false }
                );
            return message.reply({ embeds: [embed] });
        }

        let userToKick;

        const mentioned = message.mentions.members.first();
        if (mentioned) {
            userToKick = mentioned;
        } else {
            try {
                userToKick = await message.guild.members.fetch(targetIdOrMention);
            } catch {
                return message.reply(`*sorry, couldn't find a member with the id '**${targetIdOrMention}**'.*`);
            }
        }

        if (!userToKick.kickable) {
            return message.reply("*sorry, i can't kick them, maybe make my role higher?*");
        }

        try {
            await userToKick.kick(reason);
            const embed = new MessageEmbed()
                .setTitle("kicked successfully.")
                .addFields(
                    { name: "```id:```", value: `\`${userToKick.id}\``, inline: true },
                    { name: "```tag?```", value: `\`${userToKick.user.tag}\``, inline: true },
                    { name: "```why?```", value: `*${reason}*`, inline: true }
                );
            message.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            message.reply("*sorry, i couldn't kick them.*");
        }
    },
};
