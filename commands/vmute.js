const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "vmute",
  async execute(client, message, args) {
    if (!message.member.permissions.has("MUTE_MEMBERS")) {
      return message.reply("*you don't have permission to mute members.*");
    }

    if (!args[0]) {
      return message.reply("*please mention a user, channel, provide an ID, or use `all`.*");
    }

    // Mute all members in all voice channels
    if (args[0].toLowerCase() === "all") {
      let muted = [];

      message.guild.members.cache.forEach(member => {
        if (member.voice.channel && !member.voice.serverMute) {
          member.voice.setMute(true).catch(() => null);
          muted.push(`\`${member.user.tag}\``);
        }
      });

      if (muted.length === 0) {
        return message.reply("*no one is in a voice channel, or everyone is already muted.*");
      }

      const embed = new MessageEmbed()
        .setColor("DARK_BUT_NOT_BLACK")
        .setTitle("muted everyone in voice channels")
        .setDescription(muted.join("\n"))
        .setFooter({ text: `total muted: ${muted.length} | by ${message.author.tag}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // Mute all in a specific voice channel
    const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]);
    if (channel && channel.type === "GUILD_VOICE") {
      let muted = [];

      channel.members.forEach(member => {
        if (!member.voice.serverMute) {
          member.voice.setMute(true).catch(() => null);
          muted.push(`\`${member.user.tag}\``);
        }
      });

      if (muted.length === 0) {
        return message.reply("*no one is in that channel, or they're already muted.*");
      }

      const embed = new MessageEmbed()
        .setColor("DARK_BUT_NOT_BLACK")
        .setTitle(`muted everyone in ${channel.name}`)
        .setDescription(muted.join("\n"))
        .setFooter({ text: `total muted: ${muted.length} | by ${message.author.tag}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // Mute a single user
    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

    if (!target) {
      return message.reply("*please mention a valid user, or provide their ID.*");
    }

    if (!target.voice.channel) {
      return message.reply("*that user is not in a voice channel.*");
    }

    if (target.voice.serverMute) {
      return message.reply("*that user is already server muted.*");
    }

    try {
      await target.voice.setMute(true, `Successfully muted.`);

      const embed = new MessageEmbed()
        .setColor("DARK_BUT_NOT_BLACK")
        .setTitle("user server muted.")
        .addFields(
          { name: "```user```", value: `\`${target.user.tag}\``, inline: true },
          { name: "```by```", value: `\`${message.author.tag}\``, inline: true }
        )
        .setFooter("user has been server muted.")
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return message.reply("*i couldn't server mute that user.*");
    }
  },
};
