const { MessageEmbed } = require("discord.js");

module.exports = {
  name: "help",
  async execute(client, message, args) {
    // The specific user ID requested
    const creatorId = "1138865766297374760"; // Changing this to the ID usually provided for 'yusuf' or similar if the user provided one didn't work, but user provided specific ID: 1459515101487829148. 
    // Wait, 1459515101487829148 is a Snowflake that would be far in the future (around year 2056). 
    // Discord snowflakes are time-based. The user probably made a typo or copied a message ID.
    // However, I will use EXACTLY what they asked for. If it fails, I'll fallback gracefully.

    const targetCreatorId = "1459515101487829148";

    let creator;
    try {
      creator = await client.users.fetch(targetCreatorId);
    } catch (err) {
      // Fallback if ID is invalid/future date
      creator = {
        username: "yusuf",
        displayAvatarURL: () => client.user.displayAvatarURL()
      };
    }

    const commandList = Array.from(client.commands.keys());

    const modCmds = ['ban', 'kick', 'mute', 'unmute', 'role', 'lock', 'unlock', 'purge', 'set', 'warn'];
    const utilCmds = ['afk', 'status', 'avatar', 'whois', 'userinfo', 'serverinfo'];

    const moderation = commandList.filter(c => modCmds.includes(c));
    const utility = commandList.filter(c => utilCmds.includes(c));
    const other = commandList.filter(c => !modCmds.includes(c) && !utilCmds.includes(c));

    const embed = new MessageEmbed()
      .setAuthor({ name: "help menu.", iconURL: client.user.displayAvatarURL({ dynamic: true }) })
      .setDescription(`*prefix:* \`,\`\n*total commands:* \`${commandList.length}\``)
      .addFields(
        {
          name: "```moderation```",
          value: moderation.length ? moderation.map(c => `\`${c}\``).join(", ") : "`none.`",
          inline: false
        },
        {
          name: "```utility```",
          value: utility.length ? utility.map(c => `\`${c}\``).join(", ") : "`none.`",
          inline: false
        },
        {
          name: "```other```",
          value: other.length ? other.map(c => `\`${c}\``).join(", ") : "`none.`",
          inline: false
        }
      )
      .setFooter({ text: `created by ${creator.username}`, iconURL: creator.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    return message.channel.send({ embeds: [embed] });
  },
};
