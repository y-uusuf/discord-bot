const { MessageEmbed } = require("discord.js");
const Level = require("../../models/level"); // adjust path as needed

module.exports = {
  name: "aura",
  async execute(client, message, args) {

    let target =
      message.mentions.users.first() ||
      (args[0] && (await client.users.fetch(args[0]).catch(() => null))) ||
      message.author;

    const userID = target.id;
    const guildID = message.guild.id;

    let userData = await Level.findOne({ userID });

    if (!userData) {
      return message.reply(
        target.id === message.author.id
          ? "you don't have any aura yet. start chatting to get it."
          : `${target.username} doesn't have any aura yet.`
      );
    }

    const embed = new MessageEmbed()
      .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "```level```", value: `\`${userData.level}.\``, inline: true },
        { name: "```aura```", value: `\`${userData.aura.toLocaleString()}.\``, inline: true },
        { name: "```messages```", value: `\`${userData.messages} / ${15 * userData.level}.\``, inline: true }
      )
      .setFooter({ text: `requested by ${target.tag}`, iconURL: target.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },
};
