const Warn = require('../../models/warn.js');
const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");

const JAIL_ROLE_ID = '915677219437830225';

module.exports = {
  name: 'warn',
  async execute(client, message, args) {
    try {
      if (!message.guild || !message.member) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: this command can only be used in a server`);
        return message.reply({ embeds: [embed] });
      }

      if (!message.member.permissions.has('MODERATE_MEMBERS')) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you are missing **Moderate Members** permission(s) to run this command`);
        return message.reply({ embeds: [embed] });
      }

      const target = message.mentions.users.first();
      if (!target) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`⚠️ <@${message.author.id}>: warns a member breaking the rules.\n\n**usage:** \`,warn @user <reason>\`\n**example:** \`,warn @yusuf usage of slurs\``);
        return message.reply({ embeds: [embed] });
      }

      if (target.bot) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you can't warn bots`);
        return message.reply({ embeds: [embed] });
      }

      const reason = args.slice(1).join(' ');
      if (!reason) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please provide a reason for the warning`);
        return message.reply({ embeds: [embed] });
      }

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

      const warnEmbed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`⚠️ <@${message.author.id}>: warned **${target.username}** for \`${reason}\` (total: ${totalWarns})`);

      await message.channel.send({ embeds: [warnEmbed] });

      try {
        await target.send(
          `You've been warned in **${message.guild.name}** for '${reason}'. You now have **${totalWarns}** warning(s).`
        );
      } catch { }

      const guildMember = await message.guild.members.fetch(userId).catch(() => null);
      if (!guildMember) return;

      if (totalWarns === 2 || totalWarns === 5) {
        const durationMs = totalWarns === 2
          ? 24 * 60 * 60 * 1000  
          : 7 * 24 * 60 * 60 * 1000; 

        const durationStr = totalWarns === 2 ? '24 hours' : '7 days';

        const expirationDate = new Date(Date.now() + durationMs);
        warnDoc.jailedUntil = expirationDate;
        await warnDoc.save();

        await guildMember.roles.add(JAIL_ROLE_ID).catch(() => { });

        const jailEmbed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`🔒 <@${message.author.id}>: jailed **${target.username}** for ${durationStr} (reached ${totalWarns} warnings)`);

        await message.channel.send({ embeds: [jailEmbed] });

      } else if (totalWarns >= 6) {
        if (guildMember.bannable) {
          try {
            await guildMember.send(`You have been banned from **${message.guild.name}** for reaching 6 warnings.`);
          } catch { }

          try {
            await guildMember.ban({ reason: `Reached 6 warnings.` });

            const banEmbed = new MessageEmbed()
              .setColor(config.embedColor).setDescription(`🔨 <@${message.author.id}>: banned **${target.tag}** (reached 6 warnings)`);

            await message.channel.send({ embeds: [banEmbed] });
          } catch (err) {
            console.warn(`Failed to ban ${target.tag}: ${err.message}`);
          }
        }
      }

    } catch (err) {
      console.error(err);
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: something went wrong`);
      message.reply({ embeds: [embed] });
    }
  },
};
