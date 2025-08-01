const { MessageEmbed } = require("discord.js");

module.exports = {
  name: 'unlock',
  async execute(client, message, args) {
    if (!message.member.permissions.has('MANAGE_CHANNELS')) {
      return message.reply("*sorry, you can't unlock any channels.*");
    }

    const target =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]) ||
      message.channel;

    if (!target || !target.isText()) {
      return message.reply("*please, provide a valid channel ID to unlock, otherwise leave it blank to unlock this one.*");
    }

    try {
      await target.permissionOverwrites.edit(message.guild.roles.everyone, {
        SEND_MESSAGES: null, // Resets permission to default
      });

      let embed = new MessageEmbed()
        .setTitle("this channel has been unlocked.")
        .addFields({ name: "```by who?```", value: `\`${message.author.username}\``, inline: true })
        .setColor("DARK_BUT_NOT_BLACK")
        .setFooter("everyone can now send messages in this channel again.")
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.reply("*sorry, i couldn't unlock the channel.*");
    }
  },
};
