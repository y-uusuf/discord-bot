const { MessageEmbed } = require('discord.js');

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
      const noStatusEmbed = new MessageEmbed()
        .setAuthor({ name: user.user.username, iconURL: user.user.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
        .addField('**status unavailable.**', 'sorry, this user does not have any custom or rich presence status.')
        .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      return message.channel.send({ embeds: [noStatusEmbed] });
    }

    user.presence.activities.forEach((activity) => {
      // Custom status (type 4)
      if (activity.type === 'CUSTOM' || activity.type === 4) {
        const customEmbed = new MessageEmbed()
          .setAuthor({ name: user.user.username, iconURL: user.user.displayAvatarURL({ dynamic: true }) })
          .addField('**custom status?**', `${activity.emoji?.name || '`no emoji. :/`'} | \`${activity.state || '`no text. :/`'}\``)
          .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) })
          .setTimestamp();

        message.channel.send({ embeds: [customEmbed] });
      }

      // Playing (type 0)
      if (activity.type === 'PLAYING' || activity.type === 0) {
        const playingEmbed = new MessageEmbed()
          .setAuthor({ name: `${user.user.username}'s Activity` })
          .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
          .addField('```currently?```', '`playing.`', true)
          .addField('```app?```', `\`${activity.name}\`` || 'unknown / n/a.', true)
          .addField('```any details?```', `\`${activity.details}\`` || '`no details.`', false)
          .addField('```currently working on?```', `\`${activity.state}\`` || '```no state currently.```', false);

        message.channel.send({ embeds: [playingEmbed] });
      }

      // Spotify detection - check for LISTENING type (2) or name contains Spotify
      const isSpotify = (activity.type === 'LISTENING' || activity.type === 2) &&
        (activity.name === 'Spotify' || activity.name?.toLowerCase().includes('spotify'));

      if (isSpotify && activity.assets) {
        let trackImage = 'https://cdn.discordapp.com/emojis/408668371039682560.png'; // default Spotify icon

        // Handle different image formats
        if (activity.assets.largeImage) {
          if (activity.assets.largeImage.startsWith('spotify:')) {
            trackImage = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
          } else if (activity.assets.largeImageURL) {
            trackImage = activity.assets.largeImageURL();
          }
        }

        const trackName = activity.details || 'Unknown';
        let trackAuthor = activity.state || 'Unknown';
        const trackAlbum = activity.assets.largeText || 'Unknown';

        trackAuthor = trackAuthor?.replace(/;/g, ',') || 'Unknown';

        const spotifyEmbed = new MessageEmbed()
          .setAuthor({ name: 'track info.', iconURL: 'https://cdn.discordapp.com/emojis/408668371039682560.png' })
          .setThumbnail(trackImage)
          .addField('```song name?```', `\`${trackName}\`` || 'unknown / n/a.', true)
          .addField('```album?```', `\`${trackAlbum}\`` || 'unknown / n/a.', true)
          .addField('```artist(s)?```', `\`${trackAuthor}\``, false)
          .setFooter({ text: user.user.username + "'s spotify presence.", iconURL: user.user.displayAvatarURL({ dynamic: true }) });

        message.channel.send({ embeds: [spotifyEmbed] });
      }

      // Streaming (type 1)
      if (activity.type === 'STREAMING' || activity.type === 1) {
        const streamEmbed = new MessageEmbed()
          .setAuthor({ name: `${user.user.username} is streaming` })
          .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
          .addField('```platform?```', `\`${activity.name}\`` || 'unknown', true)
          .addField('```title?```', `\`${activity.details || 'No title'}\``, true)
          .addField('```url?```', activity.url || 'no url', false)
          .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) });

        message.channel.send({ embeds: [streamEmbed] });
      }

      // Watching (type 3)
      if (activity.type === 'WATCHING' || activity.type === 3) {
        const watchEmbed = new MessageEmbed()
          .setAuthor({ name: `${user.user.username}'s Activity` })
          .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
          .addField('```currently?```', '`watching.`', true)
          .addField('```what?```', `\`${activity.name}\`` || 'unknown', true)
          .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) });

        message.channel.send({ embeds: [watchEmbed] });
      }

      // Competing (type 5)
      if (activity.type === 'COMPETING' || activity.type === 5) {
        const competeEmbed = new MessageEmbed()
          .setAuthor({ name: `${user.user.username}'s Activity` })
          .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
          .addField('```currently?```', '`competing in.`', true)
          .addField('```what?```', `\`${activity.name}\`` || 'unknown', true)
          .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) });

        message.channel.send({ embeds: [competeEmbed] });
      }
    });
  },
};
