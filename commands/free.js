const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "free",
  async execute(client, message, args) {
    if (!message.member.permissions.has("MANAGE_ROLES")) {
      return message.reply("*you don't have permission to unjail members.*");
    }

    const roleId = "915677219437830225";
    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

    if (!target) {
      return message.reply("*please mention a valid user or provide their ID.*");
    }

    const jailRole = message.guild.roles.cache.get(roleId);
    if (!jailRole) {
      return message.reply("*jail role not found on this server.*");
    }

    if (!target.roles.cache.has(roleId)) {
      return message.reply("*this user is not jailed.*");
    }

    try {
      await target.roles.remove(jailRole);

      const embed = new MessageEmbed()
        .setColor("DARK_BUT_NOT_BLACK")
        .setTitle("unjailed.")
        .addFields(
          { name: "```user```", value: `\`${target.user.tag}\``, inline: true },
          { name: "```by```", value: `\`${message.author.tag}\``, inline: true }
        )
        .setFooter({ text: "user has been unjailed." })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.reply("*could not unjail this user.*");
    }
  },
};
