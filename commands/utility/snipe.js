const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");

module.exports = {
    name: "snipe",
    aliases: ["s"],
    async execute(client, message, args) {
        const snipes = client.snipes?.get(message.channel.id);

        if (!snipes || snipes.length === 0) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription("there's nothing to snipe.");
            return message.reply({ embeds: [embed] });
        }

        let index = 0;

        const getEmbed = (i) => {
            const snipe = snipes[i];
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setAuthor({
                    name: snipe.author.tag,
                    iconURL: snipe.author.displayAvatarURL({ dynamic: true })
                })
                .setDescription(snipe.content || "no text content")
                .setFooter({ text: `Deleted • ${i + 1}/${snipes.length}` })
                .setTimestamp(snipe.timestamp);

            if (snipe.image) {
                embed.setImage(snipe.image);
            }
            return embed;
        };

        const { MessageActionRow, MessageButton } = require("discord.js");

        const row = new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId("prev")
                .setLabel("◀")
                .setStyle("PRIMARY")
                .setDisabled(true), // Initially disabled since we start at 0
            new MessageButton()
                .setCustomId("next")
                .setLabel("▶")
                .setStyle("PRIMARY")
                .setDisabled(snipes.length <= 1)
        );

        const msg = await message.reply({ embeds: [getEmbed(index)], components: snipes.length > 1 ? [row] : [] });

        if (snipes.length <= 1) return;

        const collector = msg.createMessageComponentCollector({
            filter: (i) => i.user.id === message.author.id,
            time: 60000
        });

        collector.on("collect", async (i) => {
            if (i.customId === "prev") {
                index--;
                if (index < 0) index = 0;
            } else if (i.customId === "next") {
                index++;
                if (index >= snipes.length) index = snipes.length - 1;
            }

            row.components[0].setDisabled(index === 0);
            row.components[1].setDisabled(index === snipes.length - 1);

            await i.update({ embeds: [getEmbed(index)], components: [row] });
        });

        collector.on("end", async () => {
            try {
                const disabledRow = new MessageActionRow().addComponents(
                    row.components[0].setDisabled(true),
                    row.components[1].setDisabled(true)
                );
                await msg.edit({ components: [disabledRow] });
            } catch (e) {
                // Ignore if message is deleted
            }
        });
    },
};
