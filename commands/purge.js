const { Permissions } = require("discord.js");

module.exports = {
  name: 'purge',
  async execute(client, message, args) {
    if (!message.member.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES)) {
      return message.channel.send("*sorry, you can't purge messages.*")
    }

    const number = parseInt(args[0]);

    if (!number || isNaN(number) || number < 1 || number > 100) {
      return message.channel.send("*please, provide a number of messages to be deleted [`1-100`].*");
    }

    try {
      await message.channel.bulkDelete(number, true); 
      const confirmation = await message.channel.send(`**sucessfully cleared \`${number}\` message(s).**`);

      setTimeout(() => {
        confirmation.delete().catch(() => {});
      }, 3000);
    } catch (err) {
      console.error(err);
      message.channel.send("*sorry, i couldn't delete the messages, maybe they're too old?");
    }
  },
};
