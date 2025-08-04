const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "jail",
  async execute(client, message, args) {
    if (!message.member.permissions.has("MANAGE_ROLES")) {
      return message.reply("*you don't have permission to jail members.*");
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

    if (target.roles.cache.has(roleId)) {
      return message.reply("*this user is already jailed.*");
    }

    try {
      await target.roles.add(jailRole);

      const embed = new MessageEmbed()
        .setColor("RED")
        .setDescription(`\`sucessfully jailed ${target.user.username}.\``)
        .setFooter({ text: "jailed by " + message.author.username + "." })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.reply("*could not jail this user.*");
    }
  },
};
