const Warn = require('../../models/warn.js');
const { MessageEmbed } = require('discord.js');

module.exports = {
  name: 'removewarn',
  description: 'Clear one or all warnings for a user.',
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
      let warnNumber;

      // Case 1: no args → clear all warnings of self
      if (args.length === 0) {
        target = message.author;
      }
      // Case 2: one arg → could be a user mention/ID OR a warn number for self
      else if (args.length === 1) {
        if (message.mentions.users.size > 0) {
          target = message.mentions.users.first();
        } else if (/^\d{17,19}$/.test(args[0])) {
          try {
            const member = await message.guild.members.fetch(args[0]);
            if (member) target = member.user;
          } catch { }
        }

        if (!target && /^\d+$/.test(args[0])) {
          target = message.author;
          warnNumber = parseInt(args[0], 10);
        }

        if (!target) target = message.author;
      }
      // Case 3: two or more args → first arg user mention/ID, second arg warn number
      else if (args.length >= 2) {
        if (message.mentions.users.size > 0) {
          target = message.mentions.users.first();
        } else if (/^\d{17,19}$/.test(args[0])) {
          try {
            const member = await message.guild.members.fetch(args[0]);
            if (member) target = member.user;
          } catch { }
        }

        if (/^\d+$/.test(args[1])) {
          warnNumber = parseInt(args[1], 10);
        }

        if (!target) target = message.author;
      }

      const warnDoc = await Warn.findOne({ userId: target.id, guildId: message.guild.id });

      if (!warnDoc || warnDoc.warnings.length === 0) {
        const embed = new MessageEmbed()
          .setDescription(`📋 <@${message.author.id}>: **${target.username}** has no warnings to clear`);
        return message.reply({ embeds: [embed] });
      }

      if (warnNumber !== undefined) {
        if (warnNumber < 1 || warnNumber > warnDoc.warnings.length) {
          const embed = new MessageEmbed()
            .setDescription(`❌ <@${message.author.id}>: warn number must be between 1 and ${warnDoc.warnings.length}`);
          return message.reply({ embeds: [embed] });
        }

        const removedWarn = warnDoc.warnings.splice(warnNumber - 1, 1)[0];

        if (warnDoc.warnings.length === 0) {
          await Warn.deleteOne({ _id: warnDoc._id });
        } else {
          await warnDoc.save();
        }

        const embed = new MessageEmbed()
          .setDescription(`📋 <@${message.author.id}>: cleared warn #${warnNumber} for **${target.username}** (${warnDoc.warnings.length} remaining)`);

        return message.channel.send({ embeds: [embed] });
      } else {
        const count = warnDoc.warnings.length;
        await Warn.deleteOne({ userId: target.id, guildId: message.guild.id });

        const embed = new MessageEmbed()
          .setDescription(`📋 <@${message.author.id}>: cleared all **${count}** warning(s) for **${target.username}**`);

        return message.channel.send({ embeds: [embed] });
      }

    } catch (err) {
      console.error(err);
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: something went wrong while clearing warnings`);
      message.reply({ embeds: [embed] });
    }
  },
};
