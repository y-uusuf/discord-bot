const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "unban",
  async execute(client, message, args) {
    if (!message.member.permissions.has("BAN_MEMBERS")) {
      return message.reply("*sorry, you can't unban anyone.*");
    }

    const userId = args[0];
    if (!userId) return message.reply("*please, provide the user's ID of whom you want to unban.*");

    try {
      const user = await message.guild.bans.fetch(userId);
      await message.guild.members.unban(user.user);

      const embed = new MessageEmbed()
        .setTitle("unbanned successfully.")
        .addFields(
          { name: "```id:```", value: `\`${userId}\``, inline: true },
          { name: "```tag?```", value: `\`${user.user.tag}\``, inline: true }
        )
        .setColor("DARK_BUT_NOT_BLACK");

      message.reply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.channel.send("*sorry, i couldn't find anyone banned with this ID. check the ID or ban list?*");
    }
  },
};
