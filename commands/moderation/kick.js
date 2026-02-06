const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const config = require("../../config.json");

module.exports = {
    name: "kick",
    description: "Kicks a member from the server.",
    async execute(client, message, args) {
        if (!message.member.permissions.has("KICK_MEMBERS")) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you are missing **Kick Members** permission(s) to run this command`);
            return message.reply({ embeds: [embed] });
        }

        const targetIdOrMention = args[0];
        const reason = args.slice(1).join(" ") || "n/a";

        if (!targetIdOrMention) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`👢 <@${message.author.id}>: kicks a member from the server.\n\n**usage:** \`,kick @user [reason]\`\n**example:** \`,kick @yusuf spamming\``);
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
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: couldn't find a member with the id **${targetIdOrMention}**`);
                return message.reply({ embeds: [embed] });
            }
        }

        if (!userToKick.kickable) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: i can't kick them, maybe make my role higher?`);
            return message.reply({ embeds: [embed] });
        }

        if (message.author.id !== message.guild.ownerId) {
            if (message.member.roles.highest.position <= userToKick.roles.highest.position) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you need a higher role than **${userToKick.user.tag}** to kick them.`);
                return message.reply({ embeds: [embed] });
            }
        }


        const confirmEmbed = new MessageEmbed()
            .setColor(config.embedColor).setDescription(`⚠️ <@${message.author.id}>: are you sure you want to kick **${userToKick.user.tag}**? (reason: ${reason})`);

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId("kick_confirm")
                    .setLabel("Confirm")
                    .setStyle("DANGER"),
                new MessageButton()
                    .setCustomId("kick_cancel")
                    .setLabel("Cancel")
                    .setStyle("SECONDARY")
            );

        const confirmMsg = await message.reply({ embeds: [confirmEmbed], components: [row] });

        const filter = (i) => i.user.id === message.author.id && ["kick_confirm", "kick_cancel"].includes(i.customId);

        try {
            const interaction = await confirmMsg.awaitMessageComponent({ filter, time: 30000 });

            if (interaction.customId === "kick_confirm") {
                await userToKick.kick(reason);
                await interaction.update({ content: "👍", embeds: [], components: [] });
            } else {
                const cancelEmbed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: ${userToKick.user.tag} was not kicked`);
                await interaction.update({ embeds: [cancelEmbed], components: [] });
            }
        } catch (error) {
            if (error.code === "INTERACTION_COLLECTOR_ERROR") {
                const timeoutEmbed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`⏰ <@${message.author.id}>: no response received, kick cancelled`);
                await confirmMsg.edit({ embeds: [timeoutEmbed], components: [] });
            } else {
                console.error(error);
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: couldn't kick them`);
                message.reply({ embeds: [embed] });
            }
        }
    },
};
