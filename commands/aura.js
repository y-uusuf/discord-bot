const { MessageEmbed } = require("discord.js");
const Level = require("../models/level"); // adjust path as needed

module.exports = {
  name: "aura",
  async execute(client, message) {
    const userID = message.author.id;
    const guildID = message.guild.id;

    let userData = await Level.findOne({ userID, guildID });

    if (!userData) {
      return message.reply("*you don't have any aura yet. start chatting to collect it.*");
    }

    const embed = new MessageEmbed()
      .setColor("GOLD")
      .setTitle("your aura;")
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: "```level```", value: `\`${userData.level}.\``, inline: true },
        { name: "```aura```", value: `\`${userData.aura.toLocaleString()}.\``, inline: true },
        { name: "```messages```", value: `\`${userData.messages} / ${15 * userData.level}.\``, inline: true }
      )
      .setFooter({ text: `requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },
};
