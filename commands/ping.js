const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "ping",
  async execute(client, message) {
    const loadingEmbed = new MessageEmbed()
      .setTitle(":ping_pong: pinging...")
      .setColor("RED");

    const msg = await message.channel.send({ embeds: [loadingEmbed] });

    const latency = msg.createdTimestamp - message.createdTimestamp;

    let color = "GREEN";
    if (latency > 180) color = "RED";
    else if (latency > 100) color = "YELLOW";

    const resultEmbed = new MessageEmbed()
      .setColor(color)
      .setTitle(`🏓 pong! round-trip took \`${latency}ms.\``)
      .addFields({name: "```websocket ping?```", value: `${client.ws.ping}ms`, inline: true});

    msg.edit({ embeds: [resultEmbed] });
  },
};
