const Warn = require('../../models/warn.js');
const { MessageEmbed } = require('discord.js');

module.exports = {
  name: 'warns',
  async execute(client, message, args) {
    try {
      if (!message.guild || !message.member)
        return message.reply("*this command can only be used in a server.*");

      if (!message.member.permissions.has('MODERATE_MEMBERS'))
        return message.reply("*sorry, you don't have permission to view warnings.*");

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
        return message.reply(`*${target.username} has no warnings.*`);
      }

      const embed = new MessageEmbed()
        .setDescription(`\`showing all warnings for ${target.username};\``)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `requested by ${message.author.tag}, the user '${target.username}' has a total of ${warnDoc.warnings.length} warning(s).`, iconURL: message.author.displayAvatarURL() })
        .setTimestamp();

      warnDoc.warnings.forEach((warn, i) => {
        embed.addFields(
          `\`warn; #${i + 1}\``,
          `**why?** \`${warn.reason}\`\n**mod?** <@${warn.moderatorId}>\n**when?** *<t:${Math.floor(new Date(warn.timestamp).getTime() / 1000)}:F>*`
        );
      });

      message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      message.reply("*sorry, I couldn't fetch the warnings.*");
    }
  },
};
