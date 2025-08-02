const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'reload',
  async execute(client, message, args) {
    if (!message.author.id === '509117215954436122') {
      return message.reply("*sorry, you don't have permission to reload commands.*");
    }

    const commandName = args[0];
    if (!commandName) return message.reply("*please, specify a command to reload.*");

    const commandPath = path.join(__dirname, '..', `${commandName}.js`);
    if (!fs.existsSync(commandPath)) {
      return message.reply(`*command \`${commandName}\` does not exist.*`);
    }

    try {
      delete require.cache[require.resolve(commandPath)];
      const newCommand = require(commandPath);
      client.commands.set(newCommand.name, newCommand);
      message.reply(`\`${commandName}\` has been reloaded.`);
    } catch (err) {
      console.error(err);
      message.reply(`*sorry, i couldn't reload \`${commandName}\`:*\n \`${err.message}\``);
    }
  },
};
