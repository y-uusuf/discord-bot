const { MessageEmbed } = require("discord.js");

module.exports = {
    name: "snipe",
    aliases: ["s"],
    async execute(client, message, args) {
        const snipes = client.snipes?.get(message.channel.id);

        if (!snipes || snipes.length === 0) {
            return message.reply("*there's nothing to snipe.*");
        }

        const snipe = snipes[snipes.length - 1]; // Get the most recent

        const embed = new MessageEmbed()
            .setAuthor({
                name: snipe.author.tag,
                iconURL: snipe.author.displayAvatarURL({ dynamic: true })
            })
            .setDescription(snipe.content || "*no text content*")
            .setFooter({ text: `Deleted` })
            .setTimestamp(snipe.timestamp);

        if (snipe.image) {
            embed.setImage(snipe.image);
        }

        return message.reply({ embeds: [embed] });
    },
};
