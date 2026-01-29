const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const Settings = require("../../models/settings");
const Warn = require("../../models/warn");
const Webhook = require("../../models/webhook");
const TempVoice = require("../../models/tempVoice");

module.exports = {
    name: "reset",
    description: "Resets all database data for this guild (Restricted)",
    async execute(client, message, args) {
        // Restricted to specific user
        if (message.author.id !== "1459515101487829148") {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: you are not authorized to use this command.`);
            return message.reply({ embeds: [embed] });
        }

        const embed = new MessageEmbed()
            .setColor("RED")
            .setDescription(`:warning: ${message.author}: are you sure you want to reset all database data for this server?`);

        const row = new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId("confirm_reset")
                .setLabel("confirm.")
                .setStyle("DANGER")
                .setEmoji("💥")
        );

        const reply = await message.reply({ embeds: [embed], components: [row] });

        const filter = (i) => i.customId === "confirm_reset" && i.user.id === message.author.id;

        const collector = reply.createMessageComponentCollector({ filter, time: 15000, max: 1 });

        collector.on("collect", async (i) => {
            await i.deferUpdate();

            try {
                const guildId = message.guild.id;

                // Delete Data
                await Settings.deleteMany({ guildId });
                await Warn.deleteMany({ guildId });
                await Webhook.deleteMany({ guildId });
                await TempVoice.deleteMany({ guildId });

                const successEmbed = new MessageEmbed()
                    .setColor("GREEN")
                    .setDescription(`✅ ${message.author}: all database data for this guild has been wiped.`);

                await i.editReply({ embeds: [successEmbed], components: [] });

            } catch (error) {
                console.error(error);
                const errorEmbed = new MessageEmbed()
                    .setColor("RED")
                    .setDescription(`❌ **ERROR**: Failed to reset data.`);
                await i.editReply({ embeds: [errorEmbed], components: [] });
            }
        });

        collector.on("end", (collected) => {
            if (collected.size === 0) {
                reply.edit({ components: [] }).catch(() => { });
            }
        });
    }
};
