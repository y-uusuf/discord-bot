const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");

module.exports = {
  name: "vmute",
  async execute(client, message, args) {
    if (!message.member.permissions.has("MUTE_MEMBERS")) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you are missing **Mute Members** permission(s) to run this command`);
      return message.reply({ embeds: [embed] });
    }

    if (!args[0]) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`🔇 <@${message.author.id}>: server mutes a member in voice channels.\n\n**usage:** \`,vmute @user\` or \`,vmute all\``);
      return message.reply({ embeds: [embed] });
    }

    
    if (args[0].toLowerCase() === "all") {
      let muted = [];

      message.guild.members.cache.forEach(member => {
        if (member.voice.channel && !member.voice.serverMute) {
          member.voice.setMute(true).catch(() => null);
          muted.push(member.user.username);
        }
      });

      if (muted.length === 0) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: no one is in a voice channel, or everyone is already muted`);
        return message.reply({ embeds: [embed] });
      }

      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`🔇 <@${message.author.id}>: voice muted **${muted.length}** member(s)`);

      return message.channel.send({ embeds: [embed] });
    }

    
    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (channel && channel.type === "GUILD_VOICE") {
      let muted = [];

      channel.members.forEach(member => {
        if (!member.voice.serverMute) {
          member.voice.setMute(true).catch(() => null);
          muted.push(member.user.username);
        }
      });

      if (muted.length === 0) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: no one is in that channel, or they're already muted`);
        return message.reply({ embeds: [embed] });
      }

      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`🔇 <@${message.author.id}>: voice muted **${muted.length}** member(s) in <#${channel.id}>`);

      return message.channel.send({ embeds: [embed] });
    }

    
    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

    if (!target) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please mention a valid user, or provide their ID`);
      return message.reply({ embeds: [embed] });
    }

    if (!target.voice.channel) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: that user is not in a voice channel`);
      return message.reply({ embeds: [embed] });
    }

    if (target.voice.serverMute) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: that user is already server muted`);
      return message.reply({ embeds: [embed] });
    }

    try {
      await target.voice.setMute(true);
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`🔇 <@${message.author.id}>: voice muted **${target.user.username}**`);

      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: couldn't server mute that user`);
      return message.reply({ embeds: [embed] });
    }
  },
};
