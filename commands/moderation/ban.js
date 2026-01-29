const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");

module.exports = {
  name: "ban",
  async execute(client, message, args) {
    if (!message.member.permissions.has("BAN_MEMBERS")) {
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: you are missing **Ban Members** permission(s) to run this command`);
      return message.reply({ embeds: [embed] });
    }

    const targetIdOrMention = args[0];
    const reason = args.slice(1).join(" ") || "n/a";

    if (!targetIdOrMention) {
      const embed = new MessageEmbed()
        .setDescription(`🔨 <@${message.author.id}>: bans a member from the server.\n\n**usage:** \`,ban @user [reason]\`\n**example:** \`,ban @yusuf spamming\``);
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
        const embed = new MessageEmbed()
          .setDescription(`❌ <@${message.author.id}>: couldn't find a user with the id **${targetIdOrMention}**`);
        return message.reply({ embeds: [embed] });
      }
    }

    const memberToBan = message.guild.members.cache.get(userToBan.id);
    if (memberToBan && !memberToBan.bannable) {
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: i can't ban them, maybe make my role higher?`);
      return message.reply({ embeds: [embed] });
    }

    // Confirmation embed
    const confirmEmbed = new MessageEmbed()
      .setDescription(`⚠️ <@${message.author.id}>: are you sure you want to ban **${userToBan.tag || userToBan.username}**? (reason: ${reason})`);

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
        await interaction.update({ content: "👍", embeds: [], components: [] });
      } else {
        const cancelEmbed = new MessageEmbed()
          .setDescription(`❌ <@${message.author.id}>: ${userToBan.tag || userToBan.username} was not banned`);
        await interaction.update({ embeds: [cancelEmbed], components: [] });
      }
    } catch (error) {
      if (error.code === "INTERACTION_COLLECTOR_ERROR") {
        const timeoutEmbed = new MessageEmbed()
          .setDescription(`⏰ <@${message.author.id}>: no response received, ban cancelled`);
        await confirmMsg.edit({ embeds: [timeoutEmbed], components: [] });
      } else {
        console.error(error);
        const embed = new MessageEmbed()
          .setDescription(`❌ <@${message.author.id}>: couldn't ban them`);
        message.reply({ embeds: [embed] });
      }
    }
  },
};
