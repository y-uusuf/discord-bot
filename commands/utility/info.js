const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "info",
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
          return message.reply("*sorry, couldn't find a user with that ID.*");
        }
      } else {
        return message.reply("*please, mention a valid user/ID.*");
      }
    }

    const member = await message.guild.members.fetch(user.id).catch(() => null);

    const embed = new MessageEmbed()
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ dynamic: true }) })
      .addFields(
        { name: "```username?```", value: `\`${user.username}\``, inline: true },
        { name: "```display name?```", value: `\`${user.displayName}\``, inline: true },
        { name: "```id?```", value: `\`${user.id}\``, inline: true },
        { name: "```is bot?```", value: `\`${user.bot ? "yes." : "no."}\``, inline: true },
        {
          name: "```account creation date?```",
          value: `*<t:${Math.floor(user.createdTimestamp / 1000)}:F>*`,
          inline: true,
        }
      );

    if (member) {
      embed.addFields(
        { name: "```nickname?```", value: `\`${member.nickname}\`` || "```none.```", inline: true },
        { name: "```joined?```", value: `*<t:${Math.floor(member.joinedTimestamp / 1000)}:F>*`, inline: true },
        { name: "```roles?```", value: `\`${member.roles.cache.map((r) => r.name).join(", ")}\`` || "```none.```", inline: true }
      );
    } else {
      embed.setFooter("user is not in this server.");
    }

    try {
      const banInfo = await message.guild.bans.fetch(user.id);
      embed.setDescription("```WARNING!``` This user has been banned from this server.");
      embed.addFields({
        name: "```reason for ban?```",
        value: banInfo.reason,
        inline: true,
      });
    } catch (error) {
      // User is not banned, continue
    }

    embed.setTimestamp();
    message.reply({ embeds: [embed] });
  },
};
