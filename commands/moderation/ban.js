const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");

module.exports = {
  name: "ban",
  async execute(client, message, args) {
    if (!message.member.permissions.has("BAN_MEMBERS")) {
      return message.reply("*sorry, you can't ban anyone.*");
    }

    const targetIdOrMention = args[0];
    const reason = args.slice(1).join(" ") || "n/a";

    if (!targetIdOrMention) {
      const embed = new MessageEmbed()
        .setTitle("ban command")
        .setDescription("*bans a member from the server.*")
        .addFields(
          { name: "```usage```", value: "`,ban @user [reason]`", inline: false },
          { name: "```examples```", value: "`,ban @yusuf spamming`\n`,ban 123456789 bad`", inline: false }
        );
      return message.reply({ embeds: [embed] });
    }

    let userToBan;

    const mentioned = message.mentions.members.first();
    if (mentioned) {
      userToBan = mentioned.user;
    } else {
      try {
        userToBan = await client.users.fetch(targetIdOrMention);
      } catch {
        return message.reply(`*sorry, couldn't find a user with the id '**${targetIdOrMention}**'.*`)
      }
    }

    const memberToBan = message.guild.members.cache.get(userToBan.id);
    if (memberToBan && !memberToBan.bannable) {
      return message.reply("*sorry, i can't ban them, maybe make my role higher?*");
    }

    // Confirmation embed
    const confirmEmbed = new MessageEmbed()
      .setTitle("confirm ban?")
      .setDescription(`*are you sure you want to ban **${userToBan.tag || userToBan.username}**?*`)
      .addFields(
        { name: "```id:```", value: `\`${userToBan.id}\``, inline: true },
        { name: "```why?```", value: `*${reason}*`, inline: true }
      );

    const row = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId("ban_confirm")
          .setLabel("Confirm")
          .setStyle("DANGER"),
        new MessageButton()
          .setCustomId("ban_cancel")
          .setLabel("Cancel")
          .setStyle("SECONDARY")
      );

    const confirmMsg = await message.reply({ embeds: [confirmEmbed], components: [row] });

    const filter = (i) => i.user.id === message.author.id && ["ban_confirm", "ban_cancel"].includes(i.customId);

    try {
      const interaction = await confirmMsg.awaitMessageComponent({ filter, time: 30000 });

      if (interaction.customId === "ban_confirm") {
        await message.guild.members.ban(userToBan.id, { reason });
        const successEmbed = new MessageEmbed()
          .setTitle("banned successfully.")
          .addFields(
            { name: "```id:```", value: `\`${userToBan.id}\``, inline: true },
            { name: "```tag?```", value: `\`${userToBan.tag || "Unknown"}\``, inline: true },
            { name: "```why?```", value: `*${reason}*`, inline: true }
          );
        await interaction.update({ embeds: [successEmbed], components: [] });
      } else {
        const cancelEmbed = new MessageEmbed()
          .setTitle("ban cancelled.")
          .setDescription(`*${userToBan.tag || userToBan.username} was not banned.*`);
        await interaction.update({ embeds: [cancelEmbed], components: [] });
      }
    } catch (error) {
      if (error.code === "INTERACTION_COLLECTOR_ERROR") {
        const timeoutEmbed = new MessageEmbed()
          .setTitle("ban timed out.")
          .setDescription("*no response received, ban cancelled.*");
        await confirmMsg.edit({ embeds: [timeoutEmbed], components: [] });
      } else {
        console.error(error);
        message.reply("*sorry, i couldn't ban them.*");
      }
    }
  },
};
