const AFK = require("../../models/afk");
const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "afk",
  async execute(client, message, args) {
    const reason = args.join(" ") || "AFK";

    try {
      const existing = await AFK.findOne({ userID: message.author.id });

      if (existing) {
        return message.reply("*you are already marked as AFK.*");
      }

      await AFK.create({
        userID: message.author.id,
        reason,
        timestamp: new Date(), // Used for duration tracking
      });

      const embed = new MessageEmbed()
        .setAuthor({ name: "okay, you're now afk.", iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(`**<@${message.author.id}>** is now afk.`)
        .addField("```reason?```", `\`${reason}\``, true)
        .setFooter({ text: "note: you will be removed from AFK when you send a message." });

      return message.channel.send({ embeds: [embed] });

    } catch (err) {
      console.error(err);
      return message.reply("*there was an error setting your AFK status.*");
    }
  },
};
