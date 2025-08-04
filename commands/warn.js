const warn = require('../models/warn.js');
const { MessageEmbed } = require("discord.js")

module.exports = {
  name: 'warn',

  async execute(message, args) {
    // Permissions check
    if (!message.member.permissions.has('MODERATE_MEMBERS')) {
      return message.reply("*sorry, you can't warn anyone.*");
    }

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply('*please, mention someone to warn.*');
    }

    const reason = args.slice(1).join(' ');
    if (!reason) {
      return message.reply('*please, provide a reason as to why you are warning them.*');
    }

    if (target.bot) {
      return message.reply("*you can't warn bots.*");
    }

    let user = warn.findOne({ userId, guildId })
    let oldwarnCount = user.userWarnCount


    try {
      const newWarn = new warn({
        userId: target.id,
        guildId: message.guild.id,
        moderatorId: message.author.id,
        reason,
        userWarnCount: oldwarnCount + 1
      });

      await newWarn.save();

      let warnEmbed = new MessageEmbed()
      .setColor('ORANGE')
      .setAuthor({ name: "user warned sucessfully.", iconURL: target.displayAvatarURL() })
      .addFields(
        { name: '```who?```', value: `\`${target.username}\``, inline: true },
        { name: '```why?```', value: `\`${reason}\``, inline: true },
      )
      .setFooter(`warned by ${message.author.username}.`).setTimestamp()
      try {
        await target.send(
          `hello ${target.username},\n> i regret to tell you that you've been warned for '*${reason}*'.\n> please, make more mindful actions in the future. -# if you think this was an error, or the person is mod abusing, DM one of the owners or the co owner.`
        );
      } catch {
        // Can't DM user — possibly DMs are off
      }
    } catch (err) {
      console.error(err);
      message.reply('*sorry, i couldn\'t help with this.*');
    }
  },
};
