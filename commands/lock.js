const { MessageEmbed } = require("discord.js");

module.exports = {
  name: 'lock',
  async execute(client, message, args) {
    if (!message.member.permissions.has('MANAGE_CHANNELS')) {
      return message.reply("*sorry, you can't lock any channels.*");
    }

    const target =
      message.mentions.channels.first() ||
      message.guild.channels.cache.get(args[0]) ||
      message.channel;

    if (!target) {
      return message.reply("*please, provide a valid channel to lock.*");
    }

    try {
      const isVoice = target.type === "GUILD_VOICE" || target.type === "GUILD_STAGE_VOICE";
      const isText = target.type === "GUILD_TEXT" || target.type === "GUILD_NEWS";

      if (!isVoice && !isText) {
        return message.reply("*this channel type is not supported.*");
      }

      await target.permissionOverwrites.edit(message.guild.roles.everyone, {
        [isText ? 'SEND_MESSAGES' : 'CONNECT']: false,
      });

      const embed = new MessageEmbed()
        .setTitle(`${target} channel locked.`)
        .addFields({ name: "```by who?```", value: `\`${message.author.username}\``, inline: true })
        .setColor("DARK_BUT_NOT_BLACK")
        .setFooter(isText ? "users can't send messages here." : "users can't join this voice channel.")
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.reply("*sorry, i couldn't lock the channel.*");
    }
  },
};
