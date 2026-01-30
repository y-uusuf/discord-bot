const AFK = require("../../models/afk");
const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");

module.exports = {
  name: "afk",
  async execute(client, message, args) {
    const reason = args.join(" ") || "AFK";

    try {
      const existing = await AFK.findOne({ userID: message.author.id });

      if (existing) {
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you are already marked as AFK`);
        return message.reply({ embeds: [embed] });
      }

      await AFK.create({
        userID: message.author.id,
        reason,
        timestamp: new Date(),
      });

      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`💤 <@${message.author.id}>: you're now AFK - ${reason}`);

      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: there was an error setting your AFK status`);
      return message.reply({ embeds: [embed] });
    }
  },
};
