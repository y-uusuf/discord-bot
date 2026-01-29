const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "mic",
  async execute(client, message, args) {
    if (!message.member.permissions.has("MUTE_MEMBERS")) {
      return message.reply("you don't have permission to unmute members.");
    }

    if (!args[0]) {
      return message.reply("please mention a user, channel, provide an ID, or use `all`.");
    }

    // Unmute all members in all voice channels
    if (args[0].toLowerCase() === "all") {
      let unmuted = [];

      message.guild.members.cache.forEach(member => {
        if (member.voice.channel && member.voice.serverMute) {
          member.voice.setMute(false).catch(() => null);
          unmuted.push(`\`${member.user.tag}\``);
        }
      });

      if (unmuted.length === 0) {
        return message.reply("no one is in a voice channel, or everyone is already unmuted.");
      }

      const embed = new MessageEmbed()
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(unmuted.join("\n"))
        .setFooter({ text: `total unmuted: ${unmuted.length} | by ${message.author.tag}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // Unmute all in a specific voice channel
    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (channel && channel.type === "GUILD_VOICE") {
      let unmuted = [];

      channel.members.forEach(member => {
        if (member.voice.serverMute) {
          member.voice.setMute(false).catch(() => null);
          unmuted.push(`\`${member.user.tag}\``);
        }
      });

      if (unmuted.length === 0) {
        return message.reply("no one is muted in that channel.");
      }

      const embed = new MessageEmbed()
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(unmuted.join("\n"))
        .setFooter({ text: `total unmuted: ${unmuted.length} | by ${message.author.tag}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // Unmute a single user
    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

    if (!target) {
      return message.reply("please mention a valid user or provide their ID.");
    }

    if (!target.voice.channel) {
      return message.reply("that user is not in a voice channel.");
    }

    if (!target.voice.serverMute) {
      return message.reply("that user is not server muted.");
    }

    try {
      await target.voice.setMute(false, `Successfully unmuted.`);

      const embed = new MessageEmbed()
        .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .addFields(
          { name: "```user```", value: `\`${target.user.tag}\``, inline: true },
          { name: "```by```", value: `\`${message.author.tag}\``, inline: true }
        )
        .setFooter("user has been server unmuted.")
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return message.reply("i couldn't unmute that user.");
    }
  },
};
