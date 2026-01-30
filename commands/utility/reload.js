const fs = require('fs');
const path = require('path');
const { MessageEmbed } = require('discord.js');
const config = require("../../config.json");

module.exports = {
  name: 'reload',
  async execute(client, message, args) {
    if (message.author.id !== process.env.OWNER_ID) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you don't have permission to reload commands`);
      return message.reply({ embeds: [embed] });
    }

    if (!args.length) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`🔄 <@${message.author.id}>: reloads a command file.\n\n**usage:** \`,reload <command>\`\n**example:** \`,reload avatar\``);
      return message.reply({ embeds: [embed] });
    }

    const commandName = args[0].toLowerCase();
    const commandPath = path.join(__dirname, `${commandName}.js`);

    if (!fs.existsSync(commandPath)) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: the command \`${commandName}\` does not exist`);
      return message.reply({ embeds: [embed] });
    }

    try {
      delete require.cache[require.resolve(commandPath)];
      const newCommand = require(commandPath);
      client.commands.set(newCommand.name, newCommand);

      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`🔄 <@${message.author.id}>: reloaded \`${commandName}\``);
      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: couldn't reload \`${commandName}\``);
      message.reply({ embeds: [embed] });
    }
  },
};
