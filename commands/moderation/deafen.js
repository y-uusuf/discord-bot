const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "deafen",
  async execute(client, message, args) {
    if (!message.member.permissions.has("DEAFEN_MEMBERS")) {
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: you are missing **Deafen Members** permission(s) to run this command`);
      return message.reply({ embeds: [embed] });
    }

    if (!args[0]) {
      const embed = new MessageEmbed()
        .setDescription(`🔇 <@${message.author.id}>: please mention a user, provide their ID, or use \`all\``);
      return message.reply({ embeds: [embed] });
    }

    if (args[0].toLowerCase() === "all") {
      let deafened = [];

      message.guild.members.cache.forEach(member => {
        if (member.voice.channel && !member.voice.serverDeaf) {
          member.voice.setDeaf(true).catch(() => null);
          deafened.push(member.user.username);
        }
      });

      if (deafened.length === 0) {
        const embed = new MessageEmbed()
          .setDescription(`❌ <@${message.author.id}>: no one is in a voice channel or everyone is already deafened`);
        return message.reply({ embeds: [embed] });
      }

      const embed = new MessageEmbed()
        .setDescription(`🔇 <@${message.author.id}>: deafened **${deafened.length}** member(s)`);

      return message.channel.send({ embeds: [embed] });
    }

    // Single user deafen
    const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

    if (!target) {
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: please mention a valid user or provide their ID`);
      return message.reply({ embeds: [embed] });
    }

    if (!target.voice.channel) {
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: that user is not in a voice channel`);
      return message.reply({ embeds: [embed] });
    }

    if (target.voice.serverDeaf) {
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: that user is already server deafened`);
      return message.reply({ embeds: [embed] });
    }

    try {
      await target.voice.setDeaf(true);
      const embed = new MessageEmbed()
        .setDescription(`🔇 <@${message.author.id}>: deafened **${target.user.username}**`);

      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      const embed = new MessageEmbed()
        .setDescription(`❌ <@${message.author.id}>: couldn't deafen that user`);
      return message.reply({ embeds: [embed] });
    }
  },
};
