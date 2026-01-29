const { Permissions, MessageEmbed } = require("discord.js");

module.exports = {
  name: 'purge',
  async execute(client, message, args) {
    if (!message.member.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES)) {
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: you are missing **Manage Messages** permission(s) to run this command`);
      return message.reply({ embeds: [embed] });
    }

    const number = parseInt(args[0]);

    if (!number || isNaN(number) || number < 1 || number > 100) {
      const embed = new MessageEmbed()
        .setDescription(`🗑️ <@${message.author.id}>: clears a specified amount of messages.\n\n**usage:** \`,purge <amount>\`\n**example:** \`,purge 10\``);
      return message.channel.send({ embeds: [embed] });
    }

    try {
      await message.channel.bulkDelete(number, true);
      const embed = new MessageEmbed()
        .setDescription(`🗑️ <@${message.author.id}>: cleared **${number}** message(s)`);
      const confirmation = await message.channel.send({ embeds: [embed] });

      setTimeout(() => {
        confirmation.delete().catch(() => { });
      }, 3000);
    } catch (err) {
      console.error(err);
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: couldn't delete the messages, maybe they're too old?`);
      message.channel.send({ embeds: [embed] });
    }
  },
};
