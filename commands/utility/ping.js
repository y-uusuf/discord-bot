const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "ping",
  description: "Check bot latency and API ping.",
  async execute(client, message, args) {
    try {
      const start = Date.now();
      const msg = await message.reply("🏓 Pinging...");
      const end = Date.now();
      const latency = end - start;

      const embed = new MessageEmbed()
        .setTitle("Pong 🏓")
        .addFields(
          { name: "Latency", value: `\`${latency}ms\``, inline: true },
          { name: "API Latency", value: `\`${Math.round(client.ws.ping)}ms\``, inline: true }
        )
        .setColor("GREEN")
        .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() });

      await msg.edit({ content: null, embeds: [embed] });
    } catch (e) {
      console.error("Ping command failed:", e);
      message.channel.send("Ping failed.");
    }
  },
};
