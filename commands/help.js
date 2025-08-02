const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "help",
  async execute(client, message, args) {
    const commands = Array.from(client.commands.keys());

    const formattedCommands = commands.map(cmd => `**\`${cmd}\`**`).join(", ");

    // Get the message author user object to display in footer
    const yusuf = message.author;

    const embed = new MessageEmbed()
      .setColor("DARK_BUT_NOT_BLACK")
      .setTitle("avaliable commands;")
      .setDescription(formattedCommands || "*No commands found*")
      .setFooter({ text: `created by ${yusuf.username}`, iconURL: yusuf.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  },
};
