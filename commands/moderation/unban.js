const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "unban",
  async execute(client, message, args) {
    if (!message.member.permissions.has("BAN_MEMBERS")) {
      return message.reply("*sorry, you can't unban anyone.*");
    }

    const userId = args[0];
    if (!userId) {
      const embed = new MessageEmbed()
        .setTitle("unban command")
        .setDescription("*unbans a previously banned member.*")
        .addFields(
          { name: "```usage```", value: "`,unban <id>`", inline: false },
          { name: "```examples```", value: "`,unban 123456789`", inline: false }
        );
      return message.reply({ embeds: [embed] });
    }

    try {
      const user = await message.guild.bans.fetch(userId);
      await message.guild.members.unban(user.user);

      const embed = new MessageEmbed()
        .setTitle("unbanned successfully.")
        .addFields(
          { name: "```id:```", value: `\`${userId}\``, inline: true },
          { name: "```tag?```", value: `\`${user.user.tag}\``, inline: true }
        )

      message.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.channel.send("*sorry, i couldn't find anyone banned with this ID. check the ID or ban list?*");
    }
  },
};
