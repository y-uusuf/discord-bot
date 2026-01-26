const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "deafen",
  async execute(client, message, args) {
    if (!message.member.permissions.has("DEAFEN_MEMBERS")) {
      return message.reply("*you don't have permission to deafen members.*");
    }

    if (!args[0]) {
      return message.reply("*please mention a user, provide their ID, or use `all`.*");
    }

    if (args[0].toLowerCase() === "all") {
      let deafened = [];

      message.guild.members.cache.forEach(member => {
        if (member.voice.channel && !member.voice.serverDeaf) {
          member.voice.setDeaf(true).catch(() => null);
          deafened.push(`\`${member.user.tag}\``);
        }
      });

      if (deafened.length === 0) {
        return message.reply("*no one is in a voice channel or everyone is already deafened.*");
      }

      const embed = new MessageEmbed()
        .setTitle("deafened everyone in voice channels")
        .setDescription(deafened.join("\n"))
        .setFooter({ text: `total deafened: ${deafened.length} | by ${message.author.tag}` })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    }

    // Single user deafen
    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

    if (!target) {
      return message.reply("*please mention a valid user or provide their ID.*");
    }

    if (!target.voice.channel) {
      return message.reply("*that user is not in a voice channel.*");
    }

    if (target.voice.serverDeaf) {
      return message.reply("*that user is already server deafened.*");
    }

    try {
      await target.voice.setDeaf(true, `sucessfully deafened.`);

      const embed = new MessageEmbed()
        .setTitle("user server deafened.")
        .addFields(
          { name: "```user```", value: `\`${target.user.tag}\``, inline: true },
          { name: "```by```", value: `\`${message.author.tag}\``, inline: true }
        )
        .setFooter("user has been server deafened.")
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return message.reply("*i couldn't server deafen that user.*");
    }
  },
};
