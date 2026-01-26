const Warn = require('../../models/warn.js');
const { MessageEmbed } = require("discord.js");

const JAIL_ROLE_ID = '915677219437830225';

module.exports = {
  name: 'warn',
  async execute(client, message, args) {
    try {
      if (!message.guild || !message.member)
        return message.reply("*this command can only be used in a server.*");

      if (!message.member.permissions.has('MODERATE_MEMBERS'))
        return message.reply("*sorry, you can't warn anyone.*");

      const target = message.mentions.users.first();
      if (!target) {
        const embed = new MessageEmbed()
          .setTitle("warn command")
          .setDescription("*warnings a member breaking the rules.*")
          .addFields(
            { name: "```usage```", value: "`,warn @user <reason>`", inline: false },
            { name: "```examples```", value: "`,warn @yusuf usage of slurs`", inline: false }
          );
        return message.reply({ embeds: [embed] });
      }

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

      const totalWarns = warnDoc.warnings.length;

      let footerText = `this user was warned by ${message.author.username}.`;
      if (totalWarns < 2) footerText += " next sanction at 2 warns: 24h jail.";
      else if (totalWarns < 5) footerText += " next sanction at 5 warns: 7d jail.";
      else if (totalWarns < 6) footerText += " next sanction at 6 warns: permanent ban.";

      const warnEmbed = new MessageEmbed()
        .setAuthor({ name: "user warned successfully.", iconURL: target.displayAvatarURL() })
        .addFields(
          { name: '```Who?```', value: `\`${target.username}\``, inline: true },
          { name: '```Why?```', value: `\`${reason}\``, inline: true },
          { name: '```Total Warnings?```', value: `\`${totalWarns}\``, inline: true }
        )
        .setFooter({ text: footerText })
        .setTimestamp();

      await message.channel.send({ embeds: [warnEmbed] });

      try {
        await target.send(
          `Hello ${target.username},\n> You've been warned in **${message.guild.name}** for '*${reason}*'.\n> You now have **${totalWarns}** total warning(s).`
        );
      } catch { }

      const guildMember = await message.guild.members.fetch(userId).catch(() => null);
      if (!guildMember) return;

      if (totalWarns === 2 || totalWarns === 5) {
        const durationMs = totalWarns === 2
          ? 24 * 60 * 60 * 1000  // 24 hours
          : 7 * 24 * 60 * 60 * 1000; // 7 days

        const durationStr = totalWarns === 2 ? '24 hours' : '7 days';

        const expirationDate = new Date(Date.now() + durationMs);
        warnDoc.jailedUntil = expirationDate;
        await warnDoc.save();

        await guildMember.roles.add(JAIL_ROLE_ID).catch(() => { });

        const jailEmbed = new MessageEmbed()
          .setTitle(`user auto-jailed.`)
          .addFields(
            { name: '```who?```', value: `\`${target.username}\``, inline: true },
            { name: '```why?```', value: `\`reached ${totalWarns} warnings.\``, inline: true },
            { name: '```until?```', value: `<t:${Math.floor(expirationDate.getTime() / 1000)}:F>`, inline: true }
          )
          .setFooter({ text: `${target.username} was automatically jailed.` })
          .setTimestamp();

        await message.channel.send({ embeds: [jailEmbed] });

      } else if (totalWarns >= 6) {
        if (guildMember.bannable) {
          try {
            await guildMember.send(`You have been banned from **${message.guild.name}** for reaching 6 warnings.`);
          } catch { }

          try {
            await guildMember.ban({ reason: `Reached 6 warnings.` });

            const banEmbed = new MessageEmbed()
              .setTitle(`user auto-banned.`)
              .addFields(
                { name: '```Who?```', value: `\`${target.tag}\``, inline: true },
                { name: '```Reason?```', value: `\`Reached 6 warnings\``, inline: true }
              )
              .setFooter({ text: `user banned automatically.` })
              .setTimestamp();

            await message.channel.send({ embeds: [banEmbed] });
          } catch (err) {
            console.warn(`Failed to ban ${target.tag}: ${err.message}`);
            // Silently fail
          }
        } else {
          console.warn(`Cannot ban ${target.tag} due to role hierarchy.`);
        }

      }

    } catch (err) {
      console.error(err);
      message.reply("*sorry, I couldn't help with this.*");
    }
  },
};
