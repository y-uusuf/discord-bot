const { MessageEmbed } = require("discord.js");

module.exports = {
  name: 'unlock',
  async execute(client, message, args) {
    if (!message.member.permissions.has('MANAGE_CHANNELS')) {
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: you are missing **Manage Channels** permission(s) to run this command`);
      return message.reply({ embeds: [embed] });
    }

    const target =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]) ||
      message.channel;

    if (!target) {
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: please provide a valid channel to unlock`);
      return message.reply({ embeds: [embed] });
    }

    try {
      const isVoice = target.type === "GUILD_VOICE" || target.type === "GUILD_STAGE_VOICE";
      const isText = target.type === "GUILD_TEXT" || target.type === "GUILD_NEWS";

      if (!isVoice && !isText) {
        const embed = new MessageEmbed()
          .setDescription(`❌ <@${message.author.id}>: this channel type is not supported`);
        return message.reply({ embeds: [embed] });
      }

      await target.permissionOverwrites.edit(message.guild.roles.everyone, {
        [isText ? 'SEND_MESSAGES' : 'CONNECT']: null,
      });

      const embed = new MessageEmbed()
        .setDescription(`🔓 <@${message.author.id}>: unlocked <#${target.id}>`);

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: couldn't unlock the channel`);
      message.reply({ embeds: [embed] });
    }
  },
};
