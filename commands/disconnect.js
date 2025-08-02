const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "disconnect",
  async execute(client, message, args) {
    if (!message.member.permissions.has("MOVE_MEMBERS")) {
      return message.reply("*you don't have permission to disconnect members.*");
    }

    // Disconnect everyone in voice channels
    if (args[0]?.toLowerCase() === "all") {
      let disconnected = [];

      message.guild.members.cache.forEach(member => {
        if (member.voice.channel) {
          member.voice.disconnect().catch(() => null);
          disconnected.push(`\`${member.user.tag}\``);
        }
      });

      if (disconnected.length === 0) {
        return message.reply("*no one is in a voice channel to disconnect.*");
      }

      const embed = new MessageEmbed()
        .setColor("DARK_BUT_NOT_BLACK")
        .setTitle("disconnected everyone in vc.")
        .setDescription(disconnected.join("\n"))
        .setFooter({ text: `total disconnected: ${disconnected.length} | by ${message.author.tag}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // Disconnect single user
    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);

    if (!target) {
      return message.reply("*please mention a valid user, provide their ID, or use `all`.*");
    }

    if (!target.voice.channel) {
      return message.reply("*that user is not in a voice channel.*");
    }

    try {
      await target.voice.disconnect();

      const embed = new MessageEmbed()
        .setColor("RED")
        .setTitle("user disconnected.")
        .addFields(
          { name: "```user```", value: `\`${target.user.tag}\``, inline: true },
          { name: "```by```", value: `\`${message.author.tag}\``, inline: true }
        )
        .setFooter("user has been removed from vc.")
        .setTimestamp();

      message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      message.reply("*i couldn't disconnect the user.*");
    }
  },
};
