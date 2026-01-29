const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "info",
  aliases: ["whois", "userinfo"],
  async execute(client, message, args) {
    let input = args[0];
    let user;

    if (!input) {
      user = message.author;
    } else {
      const mention = message.mentions.users.first();
      if (mention) {
        user = mention;
      } else if (/^\d{17,19}$/.test(input)) {
        try {
          user = await client.users.fetch(input);
        } catch {
          const embed = new MessageEmbed()
            .setDescription(`❌ <@${message.author.id}>: couldn't find a user with that ID`);
          return message.reply({ embeds: [embed] });
        }
      } else {
        const embed = new MessageEmbed()
          .setDescription(`❌ <@${message.author.id}>: please mention a valid user or ID`);
        return message.reply({ embeds: [embed] });
      }
    }

    const member = await message.guild.members.fetch(user.id).catch(() => null);

    let info = "";
    info += `**id:** ${user.id}\n`;
    info += `**bot:** ${user.bot ? "yes" : "no"}\n`;
    info += `**created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n`;

    if (member) {
      info += `**nickname:** ${member.nickname || "none"}\n`;
      info += `**joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n`;
      info += `**roles:** ${member.roles.cache.size - 1}`;
    } else {
      info += `\n*user is not in this server*`;
    }

    const embed = new MessageEmbed()
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .setDescription(info)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }));

    try {
      const banInfo = await message.guild.bans.fetch(user.id);
      embed.setFooter({ text: `Banned: ${banInfo.reason || "no reason"}` });
    } catch { }

    message.reply({ embeds: [embed] });
  },
};
