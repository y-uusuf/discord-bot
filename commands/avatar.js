const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "avatar",
  async execute(client, message, args) {
    let user;


    if (message.mentions.users.first()) {
      user = message.mentions.users.first();
    }
    // Check for valid user ID
    else if (args[0] && /^\d{17,19}$/.test(args[0])) {
      try {
        user = await client.users.fetch(args[0]);
      } catch {
        return message.reply("*sorry, couldn't find anyone with that ID.*");
      }
    }
    // Default to message author
    else {
      user = message.author;
    }

    const embed = new MessageEmbed()
      .setDescription(`\`\`\`${user.username}'s avatar.\`\`\``)
      .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setColor("DARK_BUT_NOT_BLACK");

    message.reply({ embeds: [embed] });
  },
};
