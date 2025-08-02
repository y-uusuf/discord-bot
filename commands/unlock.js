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

    if (!target) {
      return message.reply("*please, provide a valid channel to unlock.*");
    }

    try {
      const isVoice = target.type === "GUILD_VOICE" || target.type === "GUILD_STAGE_VOICE";
      const isText = target.type === "GUILD_TEXT" || target.type === "GUILD_NEWS";

      if (!isVoice && !isText) {
        return message.reply("*this channel type is not supported.*");
      }

      await target.permissionOverwrites.edit(message.guild.roles.everyone, {
        [isText ? 'SEND_MESSAGES' : 'CONNECT']: null, // reset to default
      });

      const embed = new MessageEmbed()
        .setTitle(`${target} channel unlocked.`)
        .addFields({ name: "```by who?```", value: `\`${message.author.username}\``, inline: true })
        .setColor("DARK_BUT_NOT_BLACK")
        .setFooter(isText ? "users can now send messages here." : "users can now join this voice channel.")
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.reply("*sorry, i couldn't unlock the channel.*");
    }
  },
};
