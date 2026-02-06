const { Permissions, MessageEmbed } = require('discord.js');
const config = require('../../config.json');

module.exports = {
    name: "say",
    description: "Makes the bot say something",
    usage: "<text>", // Added for generic help handlers
    async execute(client, message, args) {
        // 1. Permission Check
        if (!message.member.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES)) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`❌ <@${message.author.id}>: you are missing **Manage Messages** permission(s) to run this command`);
            return message.reply({ embeds: [embed] });
        }

        // 2. Args Check (Usage)
        if (!args.length) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`📢 <@${message.author.id}>: makes the bot say a message.\n\n**usage:** \`,say <text>\`\n**example:** \`,say hello world\``);
            return message.channel.send({ embeds: [embed] });
        }

        // 3. Logic: Delete & Send
        try {
            const text = args.join(" ");

            await message.delete().catch(() => { }); // Delete original message
            await message.channel.send(text);       // Send as bot

        } catch (error) {
            console.error(error);
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`❌ <@${message.author.id}>: something went wrong while trying to say that message.`);
            return message.channel.send({ embeds: [embed] });
        }
    }
};
