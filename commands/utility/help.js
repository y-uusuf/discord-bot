const { MessageEmbed } = require("discord.js");
const config = require("../../config.json");
const Settings = require("../../models/settings");

module.exports = {
  name: "help",
  async execute(client, message, args) {
    
    const commandList = Array.from(client.commands.entries())
      .filter(([key, cmd]) => cmd.name === key)
      .map(([key]) => key);

    
    const settings = await Settings.findOne({ guildId: message.guild?.id });
    const prefix = settings?.prefix || ",";

    const modCmds = ['ban', 'kick', 'mute', 'unmute', 'role', 'lock', 'unlock', 'purge', 'set', 'warn', 'warns', 'removewarn', 'unban', 'deafen', 'undeafen', 'vmute', 'flag', 'invite', 'react', 'trial', 'nickname', 'slowmode'];
    const utilCmds = ['afk', 'status', 'avatar', 'info', 'ping', 'help', 'snipe', 'clearsnipe', 'hook', 'reload'];
    const funCmds = ['8ball', 'coinflip', 'dice', 'mic', 'disc', 'confess', 'aura'];

    const moderation = commandList.filter(c => modCmds.includes(c));
    const utility = commandList.filter(c => utilCmds.includes(c));
    const fun = commandList.filter(c => funCmds.includes(c));
    const other = commandList.filter(c => !modCmds.includes(c) && !utilCmds.includes(c) && !funCmds.includes(c));

    const embed = new MessageEmbed()
      .setColor(config.embedColor).setDescription(`📚 <@${message.author.id}>: help menu\n\n**prefix:** \`${prefix}\`\n**total:** ${commandList.length} commands\n\n**moderation:** ${moderation.length ? moderation.map(c => `\`${c}\``).join(", ") : "none"}\n\n**utility:** ${utility.length ? utility.map(c => `\`${c}\``).join(", ") : "none"}\n\n**fun:** ${fun.length ? fun.map(c => `\`${c}\``).join(", ") : "none"}\n\n**other:** ${other.length ? other.map(c => `\`${c}\``).join(", ") : "none"}`);

    return message.channel.send({ embeds: [embed] });
  },
};
