const { Permissions } = require("discord.js");

module.exports = {
  name: 'purge',
  async execute(client, message, args) {
    if (!message.member.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES)) {
      return message.channel.send("*sorry, you can't purge messages.*")
    }

    const number = parseInt(args[0]);

    if (!number || isNaN(number) || number < 1 || number > 100) {
      const embed = new MessageEmbed()
        .setTitle("purge command")
        .setDescription("*clears a specified amount of messages.*")
        .addFields(
          { name: "```usage```", value: "`,purge <amount>`", inline: false },
          { name: "```examples```", value: "`,purge 10`", inline: false }
        );
      return message.channel.send({ embeds: [embed] });
    }

    try {
      await message.channel.bulkDelete(number, true);
      const confirmation = await message.channel.send(`**sucessfully cleared \`${number}\` message(s).**`);

      setTimeout(() => {
        confirmation.delete().catch(() => { });
      }, 3000);
    } catch (err) {
      console.error(err);
      message.channel.send("*sorry, i couldn't delete the messages, maybe they're too old?");
    }
  },
};
