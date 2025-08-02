const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "undeafen",
  async execute(client, message, args) {
    if (!message.member.permissions.has("DEAFEN_MEMBERS")) {
      return message.reply("*you don't have permission to undeafen members.*");
    }

    if (!args[0]) {
      return message.reply("*please mention a user, provide their ID, or use `all`.*");
    }

    if (args[0].toLowerCase() === "all") {
      let undeafened = [];

      message.guild.members.cache.forEach(member => {
        if (member.voice.channel && member.voice.serverDeaf) {
          member.voice.setDeaf(false).catch(() => null);
          undeafened.push(`\`${member.user.tag}\``);
        }
      });

      if (undeafened.length === 0) {
        return message.reply("*no one is in a voice channel or everyone is already undeafened.*");
      }

      const embed = new MessageEmbed()
        .setColor("DARK_BUT_NOT_BLACK")
        .setTitle("undeafened everyone in voice channels")
        .setDescription(undeafened.join("\n"))
        .setFooter({ text: `total undeafened: ${undeafened.length} | by ${message.author.tag}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // Single user undeafen
    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

    if (!target) {
      return message.reply("*please mention a valid user or provide their ID.*");
    }

    if (!target.voice.channel) {
      return message.reply("*that user is not in a voice channel.*");
    }

    if (!target.voice.serverDeaf) {
      return message.reply("*that user is not server deafened.*");
    }

    try {
      await target.voice.setDeaf(false, `sucessfully undeafened.`);

      const embed = new MessageEmbed()
        .setColor("DARK_BUT_NOT_BLACK")
        .setTitle("user server undeafened.")
        .addFields(
          { name: "```user```", value: `\`${target.user.tag}\``, inline: true },
          { name: "```by```", value: `\`${message.author.tag}\``, inline: true }
        )
        .setFooter("user has been server undeafened.")
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return message.reply("*i couldn't undeafen that user.*");
    }
  },
};
