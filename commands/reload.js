const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'reload',
  async execute(client, message, args) {
    if (!message.author.id === '509117215954436122') {
      return message.reply("*sorry, you don't have permission to reload commands.*");
    }

    const commandName = args[0].toLowerCase();
    const commandPath = path.join(__dirname, `${commandName}.js`);

    if (!fs.existsSync(commandPath)) {
      return message.reply(`*the command \`${commandName}\` does not exist.*`);
    }

    try {
      // Remove the cached version of the command
      delete require.cache[require.resolve(commandPath)];

      // Reload the command
      const newCommand = require(commandPath);
      client.commands.set(newCommand.name, newCommand);

      message.reply(`*the command \`${commandName}\` was successfully reloaded.*`);
    } catch (error) {
      console.error(error);
      message.reply(`*sorry, i couldn't reload \`${commandName}\`.*`);
    }
  },
};
