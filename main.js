require("dotenv").config();

const { Client, Intents, MessageEmbed, WebhookClient } = require("discord.js");
const mongoose = require("mongoose");
const config = require("./config.json");
const Warn = require('./models/warn');
const AFK = require("./models/afk");
const Level = require("./models/level");
const fs = require("fs");
const path = require("path");

mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log("✅ Successfully connected to database."));

const client = new Client({
  intents: [
    "GUILDS",
    "GUILD_MESSAGES",
    "GUILD_MEMBERS",
    "GUILD_PRESENCES",
    "GUILD_MESSAGE_REACTIONS",
    "GUILD_BANS",
    "MESSAGE_CONTENT",
    "GUILD_VOICE_STATES",
    "DIRECT_MESSAGES"
  ],
  partials: ["CHANNEL", "MESSAGE", "USER"]
});

const webhook = new WebhookClient({
  id: "1401064592414736455",
  token: process.env.MSG_LOG_WEBHOOK_TOKEN,
});

client.commands = new Map();
require("./handler/commandHandler")(client);

const countSchema = new mongoose.Schema({
  channelId: String,
  currentNumber: Number,
  lastUserId: String
});
const Count = mongoose.model('Count', countSchema);

client.once("ready", () => {
  console.log(`\n${client.user.tag} is successfully online.`);

  Count.findOne({ channelId: "1404156977512452257" }).then(async doc => {
  if (!doc) {
    await new Count({
      channelId: "1404156977512452257",
      currentNumber: 1,
      lastUserId: null
    }).save();
    console.log(`✅ Initialized count for channel 1404156977512452257`);
  } else {
    console.log(`✅ Loaded existing count: ${doc.currentNumber} in 1404156977512452257`);
   }
})
  // Jail system loop
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
  }, 60 * 1000);

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
      }
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

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const isCountingChannel = message.channel.id === '1404156977512452257';

  // Custom dev response
  if (message.author.id === "509117215954436122" && message.content === "who made this bot") {
    return message.reply("you did king :face_holding_back_tears:").then(m => m.react("🤍"));
  }

  // === COUNTING CHANNEL HANDLING ===
if (isCountingChannel) {
  const content = message.content.trim();

  // Check if it's a command
  if (content.startsWith(config.prefix)) {
    const commandName = content.slice(config.prefix.length).trim().split(/ +/).shift().toLowerCase();

    if (commandName === "purge") {
      const args = content.slice(config.prefix.length).trim().split(/ +/).slice(1);
      const command = client.commands.get(commandName);
      if (command) await command.execute(client, message, args);
      return;
    }

    // Block all other commands
    await message.delete().catch(() => {});
    return message.author.send("⚠️ You can't use commands in the counting channel.");
  }

  // Check if message is only a number (int or float)
  const num = parseFloat(content);
  const isOnlyNumber = !isNaN(num) && content.match(/^[-+]?\d*\.?\d+$/);

  if (!isOnlyNumber) {
    // Just a message, not a number → ignore for counting
    return;
  }

  let countData = await Count.findOne({ channelId: message.channel.id });

  if (!countData) {
    console.warn(`[WARN] No count data found in DB for channel ${message.channel.id}`);
    return message.channel.send("⚠️ Counting data missing. Please alert a moderator.");
  }

  if (message.author.id === countData.lastUserId) {
    await message.react("❔");
    await message.reply("*you can't count twice in a row!*");
    return;
  }

  if (num !== countData.currentNumber) {
    await message.react("❌");
    await resetCount(
      message,
      countData,
      `*oooo, unfortunately that is the wrong number, we were looking for* **${countData.currentNumber}**. *restarting from 1.*`
    );
    return;
  }

  // ✅ Success
  await message.react("✅");
  countData.currentNumber++;
  countData.lastUserId = message.author.id;
  await countData.save();
  return;
}


  // === CDN GIF TRIGGER ===
  if (message.content.includes("https://cdn.discordapp.com/attachments/1198671834871251004/1402793329095086242/issa.gif")) {
    return message.reply("<@801125402927824918>").then(m => m.react('😭'));
  }

  // === DM CONFESS ONLY ===
  if (message.channel.type === "DM") {
    if (message.content.startsWith(config.prefix)) {
      const args = message.content.slice(config.prefix.length).trim().split(/ +/);
      const commandName = args.shift().toLowerCase();

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

    return;
  }

  // === LEVEL SYSTEM ===
  const userID = message.author.id;
  const guildID = message.guild.id;

  let userData = await Level.findOne({ userID });
  if (!userData) {
    userData = new Level({ userID, level: 1, messages: 0, aura: 0 });
  }

  userData.messages += 1;
  const messagesNeeded = 15 * userData.level;

  if (userData.messages >= messagesNeeded) {
    userData.level++;
    userData.messages = 0;
    const reward = messagesNeeded * 100;
    userData.aura += reward;

    const levelEmbed = new MessageEmbed()
      .setColor("GREEN")
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 512 }))
      .setDescription(`${message.author} leveled up to level **${userData.level}**.`)
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
        }
      );

    await message.channel.send({ embeds: [levelEmbed] }).catch(() => {});
  }

  await userData.save();

  // === AFK CHECK ===
  const afkUser = await AFK.findOne({ userID: message.author.id });
  if (afkUser) {
    await AFK.deleteOne({ userID: message.author.id });
    const afkEmbed = new MessageEmbed()
      .setColor(0x00ff00)
      .setDescription(`**${message.author.username}**, welcome back! I removed your AFK status.`);
    message.channel.send({ embeds: [afkEmbed] });
  }

  for (const mentioned of message.mentions.members.values()) {
    const mentionedAFK = await AFK.findOne({ userID: mentioned.id });
    if (mentionedAFK) {
      const unixTimestamp = Math.floor(mentionedAFK.timestamp.getTime() / 1000);
      const embed = new MessageEmbed()
        .setColor(0x00ffff)
        .setDescription(`**${mentioned.user.username}** is currently AFK.`)
        .addFields(
          { name: "```reason?```", value: `\`${mentionedAFK.reason || "n/a"}\``, inline: false },
          { name: "```since?```", value: `*<t:${unixTimestamp}:R>*`, inline: false },
        );
      message.channel.send({ embeds: [embed] });
    }
  }

  // === COMMANDS ===
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
    return;
  }

  // === WEBHOOK LOGGING ===
  try {
    if (message.channel.id === "1401064566984544336") {
      message.delete().then(() =>
        message.author.send("Sorry, you can't send messages in this channel."));
    } else {
      const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
      const basePayload = {
        username: `${message.author.displayName} (${message.author.username})`,
        avatarURL: message.author.displayAvatarURL({ dynamic: true }),
      };

      if (message.attachments.size > 0) {
        const files = message.attachments.map(att => ({
          attachment: att.url,
          name: att.name,
        }));

        await webhook.send({
          ...basePayload,
          content: `${message.content || "*attachment only.*"}\n-# msg link: ${messageLink} | channel: <#${message.channel.id}> | usr id: ${message.author.id}`,
          files,
        });
      } else {
        await webhook.send({
          ...basePayload,
          content: `${message.content}\n-# msg link: ${messageLink} | channel: <#${message.channel.id}> | usr id: ${message.author.id}`,
        });
      }
    }
  } catch (err) {
    console.error("Error logging message via webhook:", err);
  }
});

// === GUILD EVENTS ===
client.on("guildMemberAdd", async (member) => {
  const embed = new MessageEmbed()
    .setColor("GREEN")
    .setAuthor({ name: 'say hi!', iconURL: member.user.displayAvatarURL() })
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setDescription(`\`everyone, say hi to our newest member, ${member.user.username} (aka ${member.user.displayName}).\``)
    .setTimestamp();

  client.channels.fetch("1198671834871251004").then(ch => ch.send({ embeds: [embed] }));
});

client.on("guildMemberRemove", async (member) => {
  const embed = new MessageEmbed()
    .setColor("DARK_NAVY")
    .setAuthor({ name: 'oh..', iconURL: member.user.displayAvatarURL() })
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setDescription(`\`i guess it's goodbye to ${member.user.username} (aka ${member.user.displayName}).\``)
    .setTimestamp();

  client.channels.fetch("1198671834871251004").then(ch => ch.send({ embeds: [embed] }));
});

client.login(process.env.DISCORD_TOKEN);

// === EXPRESS KEEP-ALIVE ===
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Express server listening on port ${PORT}`));

// === COUNT RESET FUNCTION ===
async function resetCount(message, countData, reason) {
  await message.reply(reason);
  countData.currentNumber = 1;
  countData.lastUserId = null;
  await countData.save();
}
