require("dotenv").config();

const { Client, Intents, MessageEmbed, WebhookClient } = require("discord.js");
const mongoose = require("mongoose");
const config = require("./config.json");
const Warn = require('./models/warn');
const fs = require("fs");
const path = require("path");



mongoose
  .connect(process.env.MONGO_URI, {})
  .then(console.log("Sucessfully connected to database."));

// Initialize bot
const client = new Client({
  intents: [
    "GUILDS",
    "GUILD_MESSAGES",
    "GUILD_MEMBERS",
    "GUILD_PRESENCES",
    "GUILD_BANS",
    "MESSAGE_CONTENT",
    "GUILD_VOICE_STATES",
    "DIRECT_MESSAGES" // ← Add this!
  ],
  partials: ["CHANNEL", "MESSAGE", "USER"], // ← Important for DMs
});

const webhook = new WebhookClient({
  id: "1401064592414736455",
  token: process.env.MSG_LOG_WEBHOOK_TOKEN,
});

client.commands = new Map(); // Store commands

// Load command handler
require("./handler/commandHandler")(client);

// Log on
client.once("ready", () => {
  console.log(`\n${client.user.tag} is sucessfully online.`);

   setInterval(async () => {
    const now = new Date();
    const expired = await Warn.find({ jailedUntil: { $lte: now } });

    for (const doc of expired) {
      try {
        const guild = await client.guilds.fetch(doc.guildId);
        const member = await guild.members.fetch(doc.userId);

        if (member.roles.cache.has(JAIL_ROLE_ID)) {
          await member.roles.remove(JAIL_ROLE_ID);
        }

        doc.jailedUntil = null;
        await doc.save();

        console.log(`Unjailed ${member.user.tag}`);
      } catch (err) {
        console.warn(`Failed to unjail ${doc.userId}:`, err.message);
      }
    }
  }, 60 * 1000); // check every 60 seconds

  const embed = new MessageEmbed()
    .setTitle("logged on.")
    .addFields(
      {
        name: "```who?```",
        value: "```" + client.user.tag + "```",
        inline: true,
      },
      {
        name: "```token?```",
        value: `||${process.env.DISCORD_TOKEN}||`,
        inline: true,
      },
    )
    .setColor("GREEN")
    .setTimestamp();

  client.channels
    .fetch("1400926912087331006")
    .then((channel) => channel.send({ embeds: [embed] }));

  client.user.setPresence({
    activities: [{ name: config.activityName, type: `${config.activityType}` }],
    status: `${config.activityStatus}`,
  });
});

// Message handling
const AFK = require("./models/afk");
const Level = require("./models/level");

client.on("messageCreate", async (message) => {

  if (message.author.id === "509117215954436122") {
    if (message.content === "who made this bot") {
      message.reply("you did king :face_holding_back_tears:").then(m => m.react("🤍"))
    }
  }

  if (message.author.bot) return;

  if (message.content.includes("https://cdn.discordapp.com/attachments/1198671834871251004/1402793329095086242/issa.gif")) return message.reply("<@801125402927824918>").then(m => m.react('😭'))

  // Handle DM messages
  if (message.channel.type == "DM") {
    if (message.content.startsWith(config.prefix)) {
  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  // Only allow 'confess' command in DMs
  if (commandName !== "confess") {
    return message.reply("*sorry, only the `confess` command can be used in DMs.*");
  }

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(client, message, args);
  } catch (error) {
    console.error(error);
    message.reply("*sorry, something went wrong running that command.*");
  }
}

    return; // Exit early for all DM messages
  } else if (!message.guild) {
    return
  }

  // Guild message handling starts here
  // Leveling system - Handle first to track all messages
  const userID = message.author.id;
  const guildID = message.guild.id;

  let userData = await Level.findOne({ userID });

  if (!userData) {
    userData = new Level({
      userID,
      level: 1,
      messages: 0,
      aura: 0,
    });
  }

  userData.messages += 1;

  const messagesNeeded = 15 * userData.level;

  if (userData.messages >= messagesNeeded) {
    userData.level++;
    userData.messages = 0;

    const reward = messagesNeeded * 100;
    userData.aura += reward;

    const e = new MessageEmbed()
      .setColor("GREEN")
      .setThumbnail(
        message.author.displayAvatarURL({ dynamic: true, size: 512 }),
      )
      .setDescription(
        `${message.author} leveled up to level **${userData.level}**.`,
      )
      .setFooter({
        text: `hint; use the command ",aura" to see your level & how much aura you have.`,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      })
      .addFields(
        {
          name: "```aura gained?```",
          value: `\`${reward.toLocaleString()}\``,
          inline: true,
        },
        {
          name: "```total aura?```",
          value: `\`${userData.aura.toLocaleString()}\``,
          inline: true,
        },
      );

    try {
      await message.channel.send({ embeds: [e] });
    } catch (err) {
      console.error("Failed to send level-up embed:", err);
    }
  }

  await userData.save(); // Save updated progress

  // Check if the message author is AFK
  const afkUser = await AFK.findOne({ userID: message.author.id });

  if (afkUser) {
    await AFK.deleteOne({ userID: message.author.id });

    const embed = new MessageEmbed()
      .setColor(0x00ff00) // Green color in hex
      .setDescription(
        `**${message.author.username}**, welcome back! I removed your AFK status.`,
      );

    message.channel.send({ embeds: [embed] });
  }

  // Check mentioned users for AFK
  if (message.mentions.members.size > 0) {
    for (const mentioned of message.mentions.members.values()) {
      const mentionedAFK = await AFK.findOne({ userID: mentioned.id });

      if (mentionedAFK) {
        const unixTimestamp = Math.floor(
          mentionedAFK.timestamp.getTime() / 1000,
        );

        const embed = new MessageEmbed()
          .setColor(0x00ffff) // Aqua color in hex
          .setDescription(`**${mentioned.user.username}** is currently AFK.`)
          .addFields(
            {
              name: "```reason?```",
              value: `\`${mentionedAFK.reason || "n/a"}\``,
              inline: false,
            },
            {
              name: "```since?```",
              value: `*<t:${unixTimestamp}:R>*`,
              inline: false,
            },
          );

        message.channel.send({ embeds: [embed] });
      }
    }
  }

  // Check if message is a command
  if (message.content.startsWith(config.prefix)) {
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
try {

  if (message.channel.id === '1401064566984544336') {
    message.delete().then(message.author.send("Sorry, you can't send messages in this channel."))
  } else {

  const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
  const basePayload = {
    username: `${message.author.displayName} (${message.author.username})`,
    avatarURL: message.author.displayAvatarURL({ dynamic: true }),
  };
  
  if (message.attachments.size > 0) {
    // Convert attachments to the correct format for discord.js webhooks
    const files = message.attachments.map(att => ({
      attachment: att.url,
      name: att.name,
    }));
    
    await webhook.send({
      ...basePayload,
      content: `${message.content}\n-# msg link: ${messageLink} | channel: <#${message.channel.id}> | usr id: ${message.author.id}` || `*(attachment only.)*\n-# msg link: ${messageLink} | channel: <#${message.channel.id}> | usr id: ${message.author.id}`,
      files: files,
    });
  } else {
    await webhook.send({
      ...basePayload,
      content: `${message.content}\n-# msg link: ${messageLink} | channel: <#${message.channel.id}> | usr id: ${message.author.id}`,
    });
  }
}
} catch (error) {
  console.error("Error logging message via webhook:", error);
}

  }
});

client.on("guildMemberAdd", async (member) => {
  let welcomeMsg = new MessageEmbed()
  .setColor("GREEN")
  .setAuthor({ name: 'say hi!', iconURL: member.user.displayAvatarURL() })
  .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
  .setDescription(`\`everyone, say hi to our newest member, ${member.user.username} (aka ${member.user.displayName}).\``)
  .setTimestamp()

  client.channels.fetch("1198671834871251004").then(ch => ch.send({embeds: [welcomeMsg]}))
})

client.on("guildMemberRemove", async (member) => {
  let goodbyeMsg = new MessageEmbed()
  .setColor("DARK_NAVY")
  .setAuthor({ name: 'oh..', iconURL: member.user.displayAvatarURL() })
  .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
  .setDescription(`\`i guess it's goodbye to ${member.user.username} (aka ${member.user.displayName}).\``)
  .setTimestamp()

  client.channels.fetch("1198671834871251004").then(ch => ch.send({embeds: [goodbyeMsg]}))})


client.login(process.env.DISCORD_TOKEN);

// Keep-alive web server (Render requires a listening port)
const express = require("express");
const app = express();

app.get("/", (req, res) => res.send("Bot is running!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Express server listening on port ${PORT}`));