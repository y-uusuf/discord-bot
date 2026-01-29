const Warn = require('../../models/warn.js');
const { MessageEmbed } = require('discord.js');

module.exports = {
  name: 'warns',
  async execute(client, message, args) {
    try {
      if (!message.guild || !message.member) {
        const embed = new MessageEmbed()
          .setDescription(`❌ <@${message.author.id}>: this command can only be used in a server`);
        return message.reply({ embeds: [embed] });
      }

      if (!message.member.permissions.has('MODERATE_MEMBERS')) {
        const embed = new MessageEmbed()
          .setDescription(`❌ <@${message.author.id}>: you are missing **Moderate Members** permission(s) to run this command`);
        return message.reply({ embeds: [embed] });
      }

      let target;

      if (message.mentions.users.size > 0) {
        target = message.mentions.users.first();
      } else if (args[0]) {
        try {
          const member = await message.guild.members.fetch(args[0]);
          if (member) target = member.user;
        } catch { }
      }

      if (!target) target = message.author;

      const warnDoc = await Warn.findOne({ userId: target.id, guildId: message.guild.id });

      if (!warnDoc || !warnDoc.warnings.length) {
        const embed = new MessageEmbed()
          .setDescription(`📋 <@${message.author.id}>: **${target.username}** has no warnings`);
        return message.reply({ embeds: [embed] });
      }

      const warningsList = warnDoc.warnings.map((warn, i) =>
        `**#${i + 1}** - \`${warn.reason}\` by <@${warn.moderatorId}>`
      ).join('\n');

      const embed = new MessageEmbed()
        .setDescription(`📋 <@${message.author.id}>: warnings for **${target.username}** (${warnDoc.warnings.length} total)\n\n${warningsList}`);

      message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: couldn't fetch the warnings`);
      message.reply({ embeds: [embed] });
    }
  },
};
