const { MessageEmbed } = require('discord.js');
const config = require("../../config.json");

module.exports = {
  name: 'status',
  description: 'Checks user status.',
  async execute(client, message, args) {
    let user =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]) ||
      message.guild.members.cache.find(
        (r) => r.user.username.toLowerCase() === args.join(' ').toLowerCase()
      ) ||
      message.guild.members.cache.find(
        (ro) => ro.displayName.toLowerCase() === args.join(' ').toLowerCase()
      ) ||
      message.member;

    if (!user.presence || !user.presence.activities.length) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`📊 <@${message.author.id}>: **${user.user.username}** has no status or activity`);
      return message.channel.send({ embeds: [embed] });
    }

    user.presence.activities.forEach((activity) => {
      
      if (activity.type === 'CUSTOM' || activity.type === 4) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`📊 <@${message.author.id}>: **${user.user.username}**'s status: ${activity.emoji?.name || ''} ${activity.state || 'no text'}`);
        message.channel.send({ embeds: [embed] });
      }

      
      if (activity.type === 'PLAYING' || activity.type === 0) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`🎮 <@${message.author.id}>: **${user.user.username}** is playing **${activity.name}**${activity.details ? ` - ${activity.details}` : ''}`);
        message.channel.send({ embeds: [embed] });
      }

      
      const isSpotify = (activity.type === 'LISTENING' || activity.type === 2) &&
        (activity.name === 'Spotify' || activity.name?.toLowerCase().includes('spotify'));

      if (isSpotify) {
        const trackName = activity.details || 'Unknown';
        const trackAuthor = (activity.state || 'Unknown').replace(/;/g, ',');
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`🎵 <@${message.author.id}>: **${user.user.username}** is listening to **${trackName}** by ${trackAuthor}`);
        message.channel.send({ embeds: [embed] });
      }

      
      if (activity.type === 'STREAMING' || activity.type === 1) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`📺 <@${message.author.id}>: **${user.user.username}** is streaming **${activity.details || activity.name}**`);
        message.channel.send({ embeds: [embed] });
      }

      
      if (activity.type === 'WATCHING' || activity.type === 3) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`👀 <@${message.author.id}>: **${user.user.username}** is watching **${activity.name}**`);
        message.channel.send({ embeds: [embed] });
      }

      
      if (activity.type === 'COMPETING' || activity.type === 5) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`🏆 <@${message.author.id}>: **${user.user.username}** is competing in **${activity.name}**`);
        message.channel.send({ embeds: [embed] });
      }
    });
  },
};
