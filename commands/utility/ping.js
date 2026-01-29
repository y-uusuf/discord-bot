const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "ping",
  description: "Check bot latency and API ping.",
  async execute(client, message, args) {
    try {
      const start = Date.now();
      const msg = await message.reply("🏓 pinging...");
      const end = Date.now();
      const latency = end - start;

      const embed = new MessageEmbed()
        .setDescription(`🏓 <@${message.author.id}>: **${latency}ms** latency, **${Math.round(client.ws.ping)}ms** API`);

      await msg.edit({ content: null, embeds: [embed] });
    } catch (e) {
      console.error("Ping command failed:", e);
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: ping failed`);
      message.channel.send({ embeds: [embed] });
    }
  },
};
