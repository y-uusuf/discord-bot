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

// === ANTISPAM & ANTINUKE TRACKING ===
client.spamTracker = new Map(); // userId -> { messages: [], warned: boolean }
client.nukeTracker = new Map(); // oduleId -> { bans: [], kicks: [], channelDeletes: [], roleDeletes: [] }
const SPAM_THRESHOLD = 5; // messages
const SPAM_INTERVAL = 3000; // ms (5 messages in 3 seconds = spam)
const NUKE_THRESHOLD = 3; // actions in 10 seconds
const NUKE_INTERVAL = 10000; // ms
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

  // === DATABASE CLEANUP ===
  (async () => {
    console.log("🔄 Starting database cleanup...");
    const currentGuildIds = new Set(client.guilds.cache.keys());

    // 1. Purge Settings
    const allSettings = await Settings.find({});
    for (const s of allSettings) {
      if (!currentGuildIds.has(s.guildId)) {
        await Settings.deleteOne({ _id: s._id });
        console.log(`[PURGE] Removed settings for unknown guild: ${s.guildId}`);
      }
    }

    // 2. Purge Webhooks
    const allWebhooks = await Webhook.find({});
    for (const w of allWebhooks) {
      if (!currentGuildIds.has(w.guildId)) {
        await Webhook.deleteOne({ _id: w._id });
        console.log(`[PURGE] Removed webhooks for unknown guild: ${w.guildId}`);
      }
    }

    // 3. Purge Warnings
    const warnGuilds = await Warn.distinct("guildId");
    for (const gid of warnGuilds) {
      if (!currentGuildIds.has(gid)) {
        await Warn.deleteMany({ guildId: gid });
        console.log(`[PURGE] Removed warnings for unknown guild: ${gid}`);
      }
    }

    // 4. Purge Count Data
    const allCounts = await Count.find({});
    for (const c of allCounts) {
      try {
        // If channel is not in cache and fetching fails, it's likely gone or bot kicked
        const channel = await client.channels.fetch(c.channelId).catch(() => null);
        if (!channel) {
          await Count.deleteOne({ _id: c._id });
          console.log(`[PURGE] Removed count data for unknown channel: ${c.channelId}`);
        }
      } catch (e) {
        // Safe fallback
      }
    }
    console.log("✅ Database cleanup complete.");
  })();

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

  // === FLAGGED WORDS CHECK (sets flag for later logging) ===
  // Actual logging is handled in the message logging section below

  // === AUTO-REACT CHECK ===
  if (guildSettings?.autoReacts && guildSettings.autoReacts.size > 0) {
    const content = message.content.toLowerCase();
    for (const [trigger, emoji] of guildSettings.autoReacts) {
      if (content.includes(trigger.toLowerCase())) {
        try {
          await message.react(emoji);
        } catch (e) {
          // If reaction fails (not an emoji), try sending as text
          await message.channel.send(emoji).catch(() => { });
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

  // === ANTISPAM DETECTION ===
  const now = Date.now();
  const userId = message.author.id;

  if (!client.spamTracker.has(userId)) {
    client.spamTracker.set(userId, { messages: [], warned: false });
  }

  const userSpam = client.spamTracker.get(userId);
  userSpam.messages.push({ timestamp: now, messageId: message.id, channelId: message.channel.id });

  // Remove old messages outside the interval
  userSpam.messages = userSpam.messages.filter(m => now - m.timestamp < SPAM_INTERVAL);

  if (userSpam.messages.length >= SPAM_THRESHOLD) {
    // Delete all spam messages
    for (const msg of userSpam.messages) {
      try {
        const channel = await client.channels.fetch(msg.channelId);
        const spamMsg = await channel.messages.fetch(msg.messageId).catch(() => null);
        if (spamMsg) await spamMsg.delete().catch(() => { });
      } catch { }
    }

    // Warn the user (only once per spam session)
    if (!userSpam.warned) {
      userSpam.warned = true;

      // Add warning to database
      let warnDoc = await Warn.findOne({ userId, guildId: message.guild.id });
      if (!warnDoc) {
        warnDoc = new Warn({ userId, guildId: message.guild.id, warnings: [] });
      }
      warnDoc.warnings.push({
        reason: "Spam detected (auto-moderation)",
        moderatorId: client.user.id,
        timestamp: new Date()
      });
      await warnDoc.save();

      const warnEmbed = new MessageEmbed()
        .setDescription(`⚠️ <@${userId}>: you have been warned for **spamming** (${warnDoc.warnings.length} total warnings)`);
      await message.channel.send({ embeds: [warnEmbed] }).catch(() => { });

      // Reset after warning
      setTimeout(() => {
        if (client.spamTracker.has(userId)) {
          client.spamTracker.get(userId).warned = false;
        }
      }, 10000);
    }

    userSpam.messages = [];
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
            .setDescription(isFlagged ? `> 🚩 ||${displayContent}||` : displayContent)
            .addFields(
              { name: "Channel", value: `<#${message.channel.id}>`, inline: true },
              { name: "User ID", value: `\`${message.author.id}\``, inline: true },
              { name: "Message Link", value: `[Jump to message](${messageLink})`, inline: true }
            )
            .setTimestamp();

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

// === ANTINUKE: CHANNEL DELETE ===
client.on("channelDelete", async (channel) => {
  if (!channel.guild) return;

  const auditLogs = await channel.guild.fetchAuditLogs({ type: "CHANNEL_DELETE", limit: 1 }).catch(() => null);
  if (!auditLogs) return;

  const entry = auditLogs.entries.first();
  if (!entry || entry.executor.bot || entry.executor.id === channel.guild.ownerId) return;

  const executorId = entry.executor.id;
  const now = Date.now();

  if (!client.nukeTracker.has(executorId)) {
    client.nukeTracker.set(executorId, { channelDeletes: [], roleDeletes: [], bans: [] });
  }

  const tracker = client.nukeTracker.get(executorId);
  tracker.channelDeletes.push(now);
  tracker.channelDeletes = tracker.channelDeletes.filter(t => now - t < NUKE_INTERVAL);

  if (tracker.channelDeletes.length >= NUKE_THRESHOLD) {
    const member = await channel.guild.members.fetch(executorId).catch(() => null);
    if (member) {
      // Remove all roles with dangerous permissions
      for (const role of member.roles.cache.values()) {
        if (role.permissions.has("ADMINISTRATOR") || role.permissions.has("MANAGE_CHANNELS") || role.permissions.has("MANAGE_GUILD")) {
          await member.roles.remove(role).catch(() => { });
        }
      }

      const logChannel = channel.guild.channels.cache.find(c => c.name.includes("log") && c.type === "GUILD_TEXT");
      if (logChannel) {
        const embed = new MessageEmbed()
          .setColor("RED")
          .setDescription(`🛡️ **ANTINUKE:** <@${executorId}> was stripped of permissions for mass channel deletion`);
        await logChannel.send({ embeds: [embed] }).catch(() => { });
      }
    }
    tracker.channelDeletes = [];
  }
});

// === ANTINUKE: ROLE DELETE ===
client.on("roleDelete", async (role) => {
  const auditLogs = await role.guild.fetchAuditLogs({ type: "ROLE_DELETE", limit: 1 }).catch(() => null);
  if (!auditLogs) return;

  const entry = auditLogs.entries.first();
  if (!entry || entry.executor.bot || entry.executor.id === role.guild.ownerId) return;

  const executorId = entry.executor.id;
  const now = Date.now();

  if (!client.nukeTracker.has(executorId)) {
    client.nukeTracker.set(executorId, { channelDeletes: [], roleDeletes: [], bans: [] });
  }

  const tracker = client.nukeTracker.get(executorId);
  tracker.roleDeletes.push(now);
  tracker.roleDeletes = tracker.roleDeletes.filter(t => now - t < NUKE_INTERVAL);

  if (tracker.roleDeletes.length >= NUKE_THRESHOLD) {
    const member = await role.guild.members.fetch(executorId).catch(() => null);
    if (member) {
      for (const r of member.roles.cache.values()) {
        if (r.permissions.has("ADMINISTRATOR") || r.permissions.has("MANAGE_ROLES") || r.permissions.has("MANAGE_GUILD")) {
          await member.roles.remove(r).catch(() => { });
        }
      }

      const logChannel = role.guild.channels.cache.find(c => c.name.includes("log") && c.type === "GUILD_TEXT");
      if (logChannel) {
        const embed = new MessageEmbed()
          .setColor("RED")
          .setDescription(`🛡️ **ANTINUKE:** <@${executorId}> was stripped of permissions for mass role deletion`);
        await logChannel.send({ embeds: [embed] }).catch(() => { });
      }
    }
    tracker.roleDeletes = [];
  }
});

// === ANTINUKE: MASS BAN ===
client.on("guildBanAdd", async (ban) => {
  const auditLogs = await ban.guild.fetchAuditLogs({ type: "MEMBER_BAN_ADD", limit: 1 }).catch(() => null);
  if (!auditLogs) return;

  const entry = auditLogs.entries.first();
  if (!entry || entry.executor.bot || entry.executor.id === ban.guild.ownerId) return;

  const executorId = entry.executor.id;
  const now = Date.now();

  if (!client.nukeTracker.has(executorId)) {
    client.nukeTracker.set(executorId, { channelDeletes: [], roleDeletes: [], bans: [] });
  }

  const tracker = client.nukeTracker.get(executorId);
  tracker.bans.push(now);
  tracker.bans = tracker.bans.filter(t => now - t < NUKE_INTERVAL);

  if (tracker.bans.length >= NUKE_THRESHOLD) {
    const member = await ban.guild.members.fetch(executorId).catch(() => null);
    if (member) {
      for (const role of member.roles.cache.values()) {
        if (role.permissions.has("ADMINISTRATOR") || role.permissions.has("BAN_MEMBERS") || role.permissions.has("KICK_MEMBERS")) {
          await member.roles.remove(role).catch(() => { });
        }
      }

      const logChannel = ban.guild.channels.cache.find(c => c.name.includes("log") && c.type === "GUILD_TEXT");
      if (logChannel) {
        const embed = new MessageEmbed()
          .setColor("RED")
          .setDescription(`🛡️ **ANTINUKE:** <@${executorId}> was stripped of permissions for mass banning`);
        await logChannel.send({ embeds: [embed] }).catch(() => { });
      }
    }
    tracker.bans = [];
  }
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
