const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const config = require("../../config.json");

module.exports = {
  name: "unban",
  async execute(client, message, args) {
    if (!message.member.permissions.has("BAN_MEMBERS")) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you are missing **Ban Members** permission(s) to run this command`);
      return message.reply({ embeds: [embed] });
    }

    const userId = args[0];
    if (!userId) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`🔓 <@${message.author.id}>: unbans a previously banned member.\n\n**usage:** \`,unban <id>\`\n**example:** \`,unban 123456789\``);
      return message.reply({ embeds: [embed] });
    }

    let user;
    try {
      user = await message.guild.bans.fetch(userId);
    } catch {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: couldn't find anyone banned with this ID`);
      return message.reply({ embeds: [embed] });
    }

    
    const confirmEmbed = new MessageEmbed()
      .setColor(config.embedColor).setDescription(`⚠️ <@${message.author.id}>: are you sure you want to unban **${user.user.tag}**?`);

    const row = new MessageActionRow()
      .addComponents(
        new MessageButton()
          .setCustomId("unban_confirm")
          .setLabel("Confirm")
          .setStyle("SUCCESS"),
        new MessageButton()
          .setCustomId("unban_cancel")
          .setLabel("Cancel")
          .setStyle("SECONDARY")
      );

    const confirmMsg = await message.reply({ embeds: [confirmEmbed], components: [row] });

    const filter = (i) => i.user.id === message.author.id && ["unban_confirm", "unban_cancel"].includes(i.customId);

    try {
      const interaction = await confirmMsg.awaitMessageComponent({ filter, time: 30000 });

      if (interaction.customId === "unban_confirm") {
        await message.guild.members.unban(user.user);
        await interaction.update({ content: "👍", embeds: [], components: [] });
      } else {
        const cancelEmbed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: ${user.user.tag} was not unbanned`);
        await interaction.update({ embeds: [cancelEmbed], components: [] });
      }
    } catch (error) {
      if (error.code === "INTERACTION_COLLECTOR_ERROR") {
        const timeoutEmbed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`⏰ <@${message.author.id}>: no response received, unban cancelled`);
        await confirmMsg.edit({ embeds: [timeoutEmbed], components: [] });
      } else {
        console.error(error);
        const embed = new MessageEmbed()
          .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: couldn't unban them`);
        message.reply({ embeds: [embed] });
      }
    }
  },
};
