const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");

module.exports = {
    name: "add",
    description: "Get the invite link for the bot.",
    async execute(client, message, args) {
        const embed = new MessageEmbed()
            .setColor(config.embedColor)
            .setDescription(`> 🤖 <@${message.author.id}>: invite me [here](https://discord.com/oauth2/authorize?client_id=1465397285935517778&permissions=8&integration_type=0&scope=bot).`);
        return message.reply({ embeds: [embed] });
    }
};
