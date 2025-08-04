const Warn = require('../models/warn.js');
const { MessageEmbed } = require("discord.js");

module.exports = {
  name: 'warn',
  async execute(client, message, args) {
    try {
      if (!message.guild || !message.member)
        return message.reply("*this command can only be used in a server.*");

      if (!message.member.permissions.has('MODERATE_MEMBERS'))
        return message.reply("*sorry, you can't warn anyone.*");

      const target = message.mentions.users.first();
      if (!target)
        return message.reply('*please, mention someone to warn.*');

      if (target.bot)
        return message.reply("*you can't warn bots.*");

      const reason = args.slice(1).join(' ');
      if (!reason)
        return message.reply('*please, provide a reason as to why you are warning them.*');

      const userId = target.id;
      const guildId = message.guild.id;

      let warnDoc = await Warn.findOne({ userId, guildId });

      if (!warnDoc) {
        warnDoc = new Warn({
          userId,
          guildId,
          warnings: [{
            moderatorId: message.author.id,
            reason,
            timestamp: new Date()
          }]
        });
      } else {
        warnDoc.warnings.push({
          moderatorId: message.author.id,
          reason,
          timestamp: new Date()
        });
      }

      await warnDoc.save();

      const warnEmbed = new MessageEmbed()
        .setColor('ORANGE')
        .setAuthor({ name: "user warned successfully.", iconURL: target.displayAvatarURL() })
        .addFields(
          { name: '```Who?```', value: `\`${target.username}\``, inline: true },
          { name: '```Why?```', value: `\`${reason}\``, inline: true }
        )
        .setFooter({ text: `this user was warned by ${message.author.username}.` })
        .setTimestamp();

      await message.channel.send({ embeds: [warnEmbed] });

      try {
        await target.send(
          `Hello ${target.username},\n> You've been warned in **${message.guild.name}** for '*${reason}*'.\n> Please be more mindful in the future.`
        );
      } catch {
        // DMs might be off, ignore
      }

    } catch (err) {
      console.error(err);
      message.reply("*sorry, I couldn't help with this.*");
    }
  },
};
