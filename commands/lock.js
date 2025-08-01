const { MessageEmbed } = require("discord.js");

module.exports = {
  name: 'lock',
  async execute(client, message, args) {
    if (!message.member.permissions.has('MANAGE_CHANNELS')) {
      return message.reply("*sorry, you can't lock any channels.*");
    }

    // Determine the target channel
    const target =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]) ||
      message.channel;

    if (!target || !target.isText()) {
      return message.reply("*please, provide a valid channel ID to lock, otherwise leave it blank to lock this one.");
    }

    try {
      await target.permissionOverwrites.edit(message.guild.roles.everyone, {
        SEND_MESSAGES: false,
      });

      let embed = new MessageEmbed()
      .setTitle("this channel has been locked.")
      .addFields({name: "```by who?```", value: `\`${message.author.username}\``, inline: true})
      .setColor("DARK_BUT_NOT_BLACK")
      .setFooter("you can't send messages in here unless you have permission to.")
      .setTimestamp()
      message.channel.send({embeds: [embed]});
    } catch (err) {
      console.error(err);
      message.reply("*sorry, i couldn't lock the channel.*")
    }
  },
};
