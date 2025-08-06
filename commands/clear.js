const Warn = require('../models/warn.js');
const { MessageEmbed } = require('discord.js');

module.exports = {
  name: 'clear',
  description: 'Clear one or all warnings for a user.',
  async execute(client, message, args) {
    try {
      if (!message.guild || !message.member)
        return message.reply("*this command can only be used in a server.*");

      if (!message.member.permissions.has('MODERATE_MEMBERS'))
        return message.reply("*sorry, you don't have permission to clear warnings.*");

      let target;
      let warnNumber;

      // Case 1: no args → clear all warnings of self
      if (args.length === 0) {
        target = message.author;
      }
      // Case 2: one arg → could be a user mention/ID OR a warn number for self
      else if (args.length === 1) {
        // Try mention or ID first
        if (message.mentions.users.size > 0) {
          target = message.mentions.users.first();
        } else if (/^\d{17,19}$/.test(args[0])) {
          try {
            const member = await message.guild.members.fetch(args[0]);
            if (member) target = member.user;
          } catch {}
        }

        // If target not found, treat arg as warn number for self
        if (!target && /^\d+$/.test(args[0])) {
          target = message.author;
          warnNumber = parseInt(args[0], 10);
        }

        // If still no target, default to author
        if (!target) target = message.author;
      }
      // Case 3: two or more args → first arg user mention/ID, second arg warn number
      else if (args.length >= 2) {
        // First arg user
        if (message.mentions.users.size > 0) {
          target = message.mentions.users.first();
        } else if (/^\d{17,19}$/.test(args[0])) {
          try {
            const member = await message.guild.members.fetch(args[0]);
            if (member) target = member.user;
          } catch {}
        }

        // Second arg warn number
        if (/^\d+$/.test(args[1])) {
          warnNumber = parseInt(args[1], 10);
        }

        if (!target) target = message.author;
      }

      const warnDoc = await Warn.findOne({ userId: target.id, guildId: message.guild.id });

      if (!warnDoc || warnDoc.warnings.length === 0) {
        return message.reply(`*${target.username} has no warnings to clear.*`);
      }

      if (warnNumber !== undefined) {
        if (warnNumber < 1 || warnNumber > warnDoc.warnings.length) {
          return message.reply(`*warn number must be between 1 and ${warnDoc.warnings.length}.*`);
        }

        const removedWarn = warnDoc.warnings.splice(warnNumber - 1, 1)[0];

        if (warnDoc.warnings.length === 0) {
          await Warn.deleteOne({ _id: warnDoc._id });
        } else {
          await warnDoc.save();
        }

        const embed = new MessageEmbed()
          .setColor('GREEN')
          .setDescription(`\`sucessfully cleared warn #${warnNumber} for ${target.tag}.\``)
          .addFields('```reason for warn?```:', `\`${removedWarn.reason}\`` || 'No reason provided')
          .setFooter({ text: `This user has a total amount of ${warnDoc.warnings.length} warning(s) remaining.` })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      } else {
        await Warn.deleteOne({ userId: target.id, guildId: message.guild.id });

        const embed = new MessageEmbed()
          .setColor('GREEN')
          .setDescription(`\`sucessfully cleared all warnings for ${target.tag}. All ${warnDoc.warnings.length} warning(s) have been cleared.\``)
          .setFooter({ text: `This user now has 0 total warnings.` })
          .setTimestamp();

        return message.channel.send({ embeds: [embed] });
      }

    } catch (err) {
      console.error(err);
      message.reply("*sorry, something went wrong while clearing warnings.*");
    }
  },
};
