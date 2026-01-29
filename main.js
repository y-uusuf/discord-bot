require("dotenv").config();

const { Client, Intents, MessageEmbed, WebhookClient } = require("discord.js");
const mongoose = require("mongoose");
const config = require("./config.json");
const Warn = require('./models/warn');
const AFK = require("./models/afk");
const Level = require("./models/level");
const Webhook = require("./models/webhook");
const Settings = require("./models/settings");
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


client.commands = new Map();
client.trialActive = new Set();
client.snipes = new Map();
const loadedCommands = require("./handler/commandHandler")(client);
const loadedEvents = require("./handler/eventHandler")(client);

const countSchema = new mongoose.Schema({
  channelId: String,
  currentNumber: Number,
  lastUserId: String
});
const Count = mongoose.model('Count', countSchema);

client.once("ready", () => {
  console.log("loaded commands, connected to database & logged into to the bot sucessfully.");

  // Enforce Trial Channel Privacy
  client.guilds.cache.forEach(async (guild) => {
    try {
      const s = await Settings.findOne({ guildId: guild.id });
      if (s && s.trialChannel) {
        const channel = await guild.channels.fetch(s.trialChannel).catch(() => null);
        if (channel) {
          await channel.permissionOverwrites.edit(guild.id, {
            VIEW_CHANNEL: false,
            SEND_MESSAGES: false
          });
        }
      }
    } catch (e) { }
  });

  // Initialize counting data for any guild that has a counting channel configured
  // This is now dynamically loaded per-guild instead of hardcoded

  setInterval(async () => {
    const now = new Date();
    const expired = await Warn.find({ jailedUntil: { $lte: now } });

    for (const doc of expired) {
      try {
        const guild = await client.guilds.fetch(doc.guildId);
        const member = await guild.members.fetch(doc.userId);

        // Get jail role from settings
        const settings = await Settings.findOne({ guildId: doc.guildId });
        const jailRoleId = settings?.jailRole;

        if (jailRoleId && member.roles.cache.has(jailRoleId)) {
          await member.roles.remove(jailRoleId);
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
    .setTimestamp();

  const loginChannelId = process.env.LOGIN_CHANNEL_ID;
  console.log("LOGIN_CHANNEL_ID:", loginChannelId);
  if (loginChannelId) {
    client.channels
      .fetch(loginChannelId)
      .then((channel) => channel.send({ embeds: [embed] }))
      .catch((err) => console.warn("Failed to send login embed:", err.message));
  } else {
    console.warn("LOGIN_CHANNEL_ID not set in .env");
  }

  client.user.setPresence({
    activities: [{ name: config.activityName, type: `${config.activityType}` }],
    status: `${config.activityStatus}`,
  });
});

// === MESSAGE DELETE HANDLER (for snipe) ===
client.on("messageDelete", async (message) => {
  if (!message.author || message.author.bot) return;
  if (!message.guild) return;

  const snipeData = {
    content: message.content,
    author: {
      tag: message.author.tag,
      displayAvatarURL: (opts) => message.author.displayAvatarURL(opts)
    },
    image: message.attachments.first()?.url || null,
    timestamp: new Date()
  };

  if (!client.snipes.has(message.channel.id)) {
    client.snipes.set(message.channel.id, []);
  }

  const channelSnipes = client.snipes.get(message.channel.id);
  channelSnipes.push(snipeData);

  // Keep only last 10 snipes per channel
  if (channelSnipes.length > 10) {
    channelSnipes.shift();
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Get settings for counting channel check
  const guildSettings = message.guild ? await Settings.findOne({ guildId: message.guild.id }) : null;
  const prefix = guildSettings?.prefix || config.prefix;
  const isCountingChannel = guildSettings?.countingChannel && message.channel.id === guildSettings.countingChannel;
  const isTrialChannel = guildSettings?.trialChannel && message.channel.id === guildSettings.trialChannel;

  // === FLAGGED WORDS CHECK ===
  if (guildSettings?.flaggedWords?.length > 0 && !message.author.bot) {
    const content = message.content.toLowerCase();
    const flagged = guildSettings.flaggedWords.find(word => content.includes(word.toLowerCase()));

    if (flagged) {
      if (guildSettings.logChannel) {
        const logChannel = message.guild.channels.cache.get(guildSettings.logChannel);
        if (logChannel) {
          const embed = new MessageEmbed()
            .setColor("RED")
            .setDescription(`**User:** ${message.author} (\`${message.author.id}\`)\n**Message:** [Jump to Message](${message.url})\n**Flagged Word:** \`${flagged}\`\n\n**Content:**\n${message.content}`)
            .setFooter({ text: "flagged message detected" })
            .setTimestamp();

          const payload = { embeds: [embed] };
          if (guildSettings.flagLogPing) {
            payload.content = `<@&${guildSettings.flagLogPing}>`;
          }

          logChannel.send(payload).catch(() => { });
        }
      }
    }
  }

  // === AUTO-REACT CHECK ===
  if (guildSettings?.autoReacts && guildSettings.autoReacts.size > 0) {
    const content = message.content.toLowerCase();
    for (const [trigger, emoji] of guildSettings.autoReacts) {
      if (content.includes(trigger.toLowerCase())) {
        try {
          await message.react(emoji);
        } catch (e) {
          // Emoji might be invalid or bot can't use it
        }
      }
    }
  }

  if (isTrialChannel && !client.trialActive?.has(message.guild.id)) {
    await message.delete().catch(() => { });
    return;
  }

  // Custom dev response
  if (message.author.id === "509117215954436122" && message.content === "who made this bot") {
    return message.reply("you did king :face_holding_back_tears:").then(m => m.react("🤍"));
  }

  // === COUNTING CHANNEL HANDLING ===
  if (isCountingChannel) {
    const content = message.content.trim();

    // Check if it's a command
    if (content.startsWith(prefix)) {
      const commandName = content.slice(prefix.length).trim().split(/ +/).shift().toLowerCase();

      if (commandName === "purge") {
        const args = content.slice(prefix.length).trim().split(/ +/).slice(1);
        const command = client.commands.get(commandName);
        if (command) await command.execute(client, message, args);
        return;
      }

      // Block all other commands
      await message.delete().catch(() => { });
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

    // Auto-create count data if it doesn't exist for this configured counting channel
    if (!countData) {
      countData = new Count({
        channelId: message.channel.id,
        currentNumber: 1,
        lastUserId: null
      });
      await countData.save();
      console.log(`[INFO] Created new count data for channel ${message.channel.id}`);
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
        `*unfortunately that is the wrong number, we were looking for* **${countData.currentNumber}**. *restarting from 1.*`
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
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
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

    // Send to level channel if configured, otherwise current channel
    const targetChannel = guildSettings?.levelChannel
      ? message.guild.channels.cache.get(guildSettings.levelChannel) || message.channel
      : message.channel;

    await targetChannel.send({ embeds: [levelEmbed] }).catch(() => { });
  }

  await userData.save();

  // === AFK CHECK ===
  const afkUser = await AFK.findOne({ userID: message.author.id });
  if (afkUser) {
    await AFK.deleteOne({ userID: message.author.id });
    const afkEmbed = new MessageEmbed()
      .setDescription(`**${message.author.username}**, welcome back! I removed your AFK status.`);
    message.channel.send({ embeds: [afkEmbed] });
  }

  for (const mentioned of message.mentions.members.values()) {
    const mentionedAFK = await AFK.findOne({ userID: mentioned.id });
    if (mentionedAFK) {
      const unixTimestamp = Math.floor(mentionedAFK.timestamp.getTime() / 1000);
      const embed = new MessageEmbed()
        .setDescription(`**${mentioned.user.username}** is currently AFK.`)
        .addFields(
          { name: "```reason?```", value: `\`${mentionedAFK.reason || "n/a"}\``, inline: false },
          { name: "```since?```", value: `*<t:${unixTimestamp}:R>*`, inline: false },
        );
      message.channel.send({ embeds: [embed] });
    }
  }

  // === COMMANDS ===
  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
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

  // === MESSAGE LOGGING ===
  try {
    if (message.channel.id === "1401064566984544336") {
      message.delete().then(() =>
        message.author.send("Sorry, you can't send messages in this channel."));
    } else {
      const webhookConfig = await Webhook.findOne({ guildId: message.guild.id });
      const settingsConfig = await Settings.findOne({ guildId: message.guild.id });

      // Determine content display (sticker vs attachment vs text)
      let displayContent = message.content;
      if (!displayContent) {
        if (message.stickers.size > 0) {
          displayContent = "*sticker only.*";
        } else if (message.attachments.size > 0) {
          displayContent = "*attachment only.*";
        } else {
          displayContent = "*no content.*";
        }
      }

      // Check if message is flagged
      const isFlagged = settingsConfig?.flaggedWords?.length > 0 &&
        settingsConfig.flaggedWords.some(word => message.content.toLowerCase().includes(word.toLowerCase()));

      const messageLink = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
      const logContent = `${displayContent}\n-# msg link: ${messageLink} | channel: <#${message.channel.id}> | usr id: ${message.author.id}`;

      // Try webhook first
      if (webhookConfig?.msgLog?.id && webhookConfig?.msgLog?.token) {
        const webhook = new WebhookClient({
          id: webhookConfig.msgLog.id,
          token: webhookConfig.msgLog.token,
        });

        const basePayload = {
          username: `${message.author.displayName} (${message.author.username})`,
          avatarURL: message.author.displayAvatarURL({ dynamic: true }),
        };

        if (message.attachments.size > 0) {
          const files = message.attachments.map(att => ({
            attachment: att.url,
            name: att.name,
          }));
          await webhook.send({ ...basePayload, content: logContent, files });
        } else {
          await webhook.send({ ...basePayload, content: logContent });
        }
      }
      // Fallback to log channel from settings
      else if (settingsConfig?.logChannel) {
        const logChannel = await client.channels.fetch(settingsConfig.logChannel).catch(() => null);
        if (logChannel) {
          const logEmbed = new MessageEmbed()
            .setAuthor({
              name: `${message.author.username}`,
              iconURL: message.author.displayAvatarURL({ dynamic: true })
            })
            .setDescription(displayContent)
            .addFields(
              { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
              { name: "User ID", value: `\`${message.author.id}\``, inline: true },
              { name: "Message Link", value: `[Jump to message](${messageLink})`, inline: true }
            )
            .setTimestamp();

          // If flagged, make it red
          if (isFlagged) {
            logEmbed.setColor("RED");
          }

          if (message.attachments.size > 0) {
            const firstImage = message.attachments.find(att => att.contentType?.startsWith('image/'));
            if (firstImage) logEmbed.setImage(firstImage.url);
            logEmbed.addField("Attachments", message.attachments.map(a => `[${a.name}](${a.url})`).join('\n'));
          }

          // Send with ping if flagged
          const payload = { embeds: [logEmbed] };
          if (isFlagged && settingsConfig.flagLogPing) {
            payload.content = `<@&${settingsConfig.flagLogPing}>`;
          }

          await logChannel.send(payload);
        }
      }
    }
  } catch (err) {
    console.error("Error logging message:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);

// === EXPRESS KEEP-ALIVE ===
const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Express server listening on port ${PORT}`));

module.exports = app;

// === COUNT RESET FUNCTION ===
async function resetCount(message, countData, reason) {
  await message.reply(reason);
  countData.currentNumber = 1;
  countData.lastUserId = null;
  await countData.save();
}
