const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");

module.exports = {
  name: "avatar",
  aliases: ["av"],
  description: "Displays a user's avatar.",
  async execute(client, message, args) {
    let user;

    if (message.mentions.users.first()) {
      user = message.mentions.users.first();
    }
    else if (args[0] && /^\d{17,19}$/.test(args[0])) {
      try {
        user = await client.users.fetch(args[0]);
      } catch {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: couldn't find anyone with that ID`);
        return message.reply({ embeds: [embed] });
      }
    }
    else {
      user = message.author;
    }

    const embed = new MessageEmbed()
      .setColor(config.embedColor).setDescription(`🖼️ <@${message.author.id}>: **${user.username}**'s avatar`)
      .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }));

    message.reply({ embeds: [embed] });
  },
};
