const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "ban",
  async execute(client, message, args) {
    if (!message.member.permissions.has("BAN_MEMBERS")) {
      return message.reply("*sorry, you can't ban anyone.*");
    }

    const targetIdOrMention = args[0];
    const reason = args.slice(1).join(" ") || "n/a";

    if (!targetIdOrMention) return message.reply("*please, mention a valid username/ID or just ping them.*");

    let userToBan;

    const mentioned = message.mentions.members.first();
    if (mentioned) {
      userToBan = mentioned;
    } else {
      try {
        const fetchedUser = await client.users.fetch(targetIdOrMention);
        userToBan = fetchedUser;
      } catch {
        return message.reply(`"*sorry, couldn't find a user with the id '**${targetIdOrMention}**'."`);
      }
    }

    const memberToBan = message.guild.members.cache.get(userToBan.id);
    if (memberToBan && !memberToBan.bannable) {
      return message.reply("*sorry, i can't ban them, maybe make my role higher?*");
    }

    try {
      await message.guild.members.ban(userToBan.id, { reason });
      const embed = new MessageEmbed()
        .setTitle("banned successfully.")
        .addFields(
          { name: "```id:```", value: `\`${userToBan.id}\``, inline: true },
          { name: "```tag?```", value: `\`${userToBan.tag || "Unknown"}\``, inline: true },
          { name: "```why?```", value: `*${reason}*`, inline: true }
        )
        .setColor("DARK_BUT_NOT_BLACK");
      message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      message.reply("*sorry, i couldn't ban them.*");
    }
  },
};
