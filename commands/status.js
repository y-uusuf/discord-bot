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
        .setColor('RED')
        .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
        .addField('**status unavailable.**', 'sorry, this user does not have any custom or rich presence status.')
        .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      return message.channel.send({ embeds: [noStatusEmbed] });
    }

    user.presence.activities.forEach((activity) => {
      if (activity.type === 'CUSTOM') {
        const customEmbed = new MessageEmbed()
          .setAuthor({ name: user.user.username, iconURL: user.user.displayAvatarURL({ dynamic: true }) })
          .setColor('GREEN')
          .addField('**custom status?**', `${activity.emoji?.name || 'no emoji. :/'} | ${activity.state || 'no text. :/'}`)
          .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
          .setFooter({ text: message.guild.name, iconURL: message.guild.iconURL({ dynamic: true }) })
          .setTimestamp();

        message.channel.send({ embeds: [customEmbed] });
      }

      if (activity.type === 'PLAYING') {
        const playingEmbed = new MessageEmbed()
          .setAuthor({ name: `${user.user.username}'s Activity` })
          .setColor('YELLOW')
          .setThumbnail(user.user.displayAvatarURL({ dynamic: true }))
          .addField('```currently?```', '`playing.`', true)
          .addField('```app?```', `\`${activity.name}\`` || 'unknown / n/a.', true)
          .addField('```any details?```', `\`${activity.details}\`` || '`no details.`', false)
          .addField('```currently working on?```',`\`${activity.state}\`` || '```no state currently.```', false);

        message.channel.send({ embeds: [playingEmbed] });
      }

      if (activity.type === 'LISTENING' && activity.name === 'Spotify' && activity.assets) {
        const trackImage = `https://i.scdn.co/image/${activity.assets.largeImage.slice(8)}`;
        const trackURL = `https://open.spotify.com/track/${activity.syncID}`;
        const trackName = activity.details;
        let trackAuthor = activity.state;
        const trackAlbum = activity.assets.largeText;

        trackAuthor = trackAuthor?.replace(/;/g, ',') || 'Unknown';

        const spotifyEmbed = new MessageEmbed()
          .setAuthor({ name: 'track info.', iconURL: 'https://cdn.discordapp.com/emojis/408668371039682560.png' })
          .setColor('GREEN')
          .setThumbnail(trackImage)
          .addField('```song name?```', `\`${trackName}\`` || 'unknown / n/a.', true)
          .addField('```album?```', `\`${trackAlbum}\`` || 'unknown / n/a.', true)
          .addField('```artist(s)?```', `\`${trackAuthor}\``, false)
          .addField('```listen to it:```', `[*opens in spotify.*](${trackURL})`, false)
          .setFooter({ text: user.user.username + "'s spotify presence.", iconURL: user.user.displayAvatarURL({ dynamic: true }) });

        message.channel.send({ embeds: [spotifyEmbed] });

      }
    });
  },
};
