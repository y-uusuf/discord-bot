require("dotenv").config({ debug: false });
process.env.FFMPEG_PATH = require('@ffmpeg-installer/ffmpeg').path;
const { Client, Intents, MessageEmbed, WebhookClient } = require("discord.js");
const mongoose = require("mongoose");
const config = require("./config.json");
const Warn = require('./models/warn');
const AFK = require("./models/afk");
const Level = require("./models/level");
const Webhook = require("./models/webhook");

const Settings = require("./models/settings");
const Blacklist = require("./models/blacklist");

const fs = require("fs");
const path = require("path");

mongoose.connect(process.env.MONGO_URI, {});

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


client.spamTracker = new Map();
client.nukeTracker = new Map();
const SPAM_THRESHOLD = 5;
const SPAM_INTERVAL = 3000;
const NUKE_THRESHOLD = 3;
const NUKE_INTERVAL = 10000;
const loadedCommands = require("./handler/commandHandler")(client);
const loadedEvents = require("./handler/eventHandler")(client);

const countSchema = new mongoose.Schema({
  channelId: String,
  currentNumber: Number,
  lastUserId: String
});
const Count = mongoose.model('Count', countSchema);

client.once("ready", () => {


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





  (async () => {

    const currentGuildIds = new Set(client.guilds.cache.keys());


    const allSettings = await Settings.find({});
    for (const s of allSettings) {
      if (!currentGuildIds.has(s.guildId)) {
        await Settings.deleteOne({ _id: s._id });

      }
    }


    const allWebhooks = await Webhook.find({});
    for (const w of allWebhooks) {
      if (!currentGuildIds.has(w.guildId)) {
        await Webhook.deleteOne({ _id: w._id });

      }
    }


    const warnGuilds = await Warn.distinct("guildId");
    for (const gid of warnGuilds) {
      if (!currentGuildIds.has(gid)) {
        await Warn.deleteMany({ guildId: gid });

      }
    }


    const allCounts = await Count.find({});
    for (const c of allCounts) {
      try {

        const channel = await client.channels.fetch(c.channelId).catch(() => null);
        if (!channel) {
          await Count.deleteOne({ _id: c._id });

        }
      } catch (e) {

      }
    }

  })();

  setInterval(async () => {
    const now = new Date();
    const expired = await Warn.find({ jailedUntil: { $lte: now } });

    for (const doc of expired) {
      try {
        const guild = await client.guilds.fetch(doc.guildId);
        const member = await guild.members.fetch(doc.userId);


        const settings = await Settings.findOne({ guildId: doc.guildId });
        const jailRoleId = settings?.jailRole;

        if (jailRoleId && member.roles.cache.has(jailRoleId)) {
          await member.roles.remove(jailRoleId);
        }

        doc.jailedUntil = null;
        await doc.save();


      } catch (err) {
        console.warn(`Failed to unjail ${doc.userId}:`, err.message);
      }
    }
  }, 60 * 1000);

  const embed = new MessageEmbed()
    .setColor(config.embedColor).setAuthor({ name: "logged on.", iconURL: client.user.displayAvatarURL({ dynamic: true }) })
    .setDescription(`> :bust_in_silhouette: ${client.user.tag}: sucessfully logged on.`)
    .setTimestamp();

  const loginChannelId = process.env.LOGIN_CHANNEL_ID;

  if (loginChannelId) {
    client.channels
      .fetch(loginChannelId)
      .then((channel) => channel.send({ embeds: [embed] }))
      .catch((err) => console.warn("Failed to send login embed:", err.message));
  } else {
    console.warn("LOGIN_CHANNEL_ID not set in .env");
  }

  // Check if .local file exists to indicate development mode
  const isLocalDev = fs.existsSync(path.join(__dirname, '.local'));
  const activityName = isLocalDev ? ',help - being edited.' : config.activityName;

  client.user.setPresence({
    activities: [{ name: activityName, type: `${config.activityType}` }],
    status: `${config.activityStatus}`,
  });
});


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


  if (channelSnipes.length > 10) {
    channelSnipes.shift();
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;


  const guildSettings = message.guild ? await Settings.findOne({ guildId: message.guild.id }) : null;
  const prefix = guildSettings?.prefix || config.prefix;
  const isCountingChannel = guildSettings?.countingChannel && message.channel.id === guildSettings.countingChannel;
  const isTrialChannel = guildSettings?.trialChannel && message.channel.id === guildSettings.trialChannel;





  if (guildSettings?.autoReacts && guildSettings.autoReacts.size > 0) {
    const content = message.content.toLowerCase();
    for (const [trigger, emoji] of guildSettings.autoReacts) {
      if (content.includes(trigger.toLowerCase())) {
        try {
          await message.react(emoji);
        } catch (e) {

          await message.channel.send(emoji).catch(() => { });
        }
      }
    }
  }

  if (isTrialChannel && !client.trialActive?.has(message.guild.id)) {
    await message.delete().catch(() => { });
    return;
  }

  if (isCountingChannel) {
    const content = message.content.trim();


    if (content.startsWith(prefix)) {
      const commandName = content.slice(prefix.length).trim().split(/ +/).shift().toLowerCase();

      if (commandName === "purge") {
        const args = content.slice(prefix.length).trim().split(/ +/).slice(1);
        const command = client.commands.get(commandName);
        if (command) await command.execute(client, message, args);
        return;
      }


      await message.delete().catch(() => { });
      return message.author.send("⚠️ You can't use commands in the counting channel.");
    }


    const num = parseFloat(content);
    const isOnlyNumber = !isNaN(num) && content.match(/^[-+]?\d*\.?\d+$/);

    if (!isOnlyNumber) {

      return;
    }

    let countData = await Count.findOne({ channelId: message.channel.id });


    if (!countData) {
      countData = new Count({
        channelId: message.channel.id,
        currentNumber: 1,
        lastUserId: null
      });
      await countData.save();

    }

    if (message.author.id === countData.lastUserId) {
      await message.react("❓");
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`> ${message.author}: ❓ *you can't count twice in a row!*`);
      await message.reply({ embeds: [embed] });
      return;
    }

    if (num !== countData.currentNumber) {
      await message.react("❌");
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`> ${message.author}: ❌ *unfortunately that is the wrong number, we were looking for* **${countData.currentNumber}**. *restarting from 1.*`);

      await resetCount(message, countData, { embeds: [embed] });
      return;
    }


    await message.react("✅").catch(() => { });
    countData.currentNumber++;
    countData.lastUserId = message.author.id;
    await countData.save();
    return;
  }



  if (message.content.includes("https://cdn.discordapp.com/attachments/1198671834871251004/1402793329095086242/issa.gif")) {
    return message.reply("<@801125402927824918>").then(m => m.react('😭'));
  }


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


  const now = Date.now();
  const userId = message.author.id;

  if (!client.spamTracker.has(userId)) {
    client.spamTracker.set(userId, { messages: [], warned: false });
  }

  const userSpam = client.spamTracker.get(userId);
  userSpam.messages.push({ timestamp: now, messageId: message.id, channelId: message.channel.id });


  userSpam.messages = userSpam.messages.filter(m => now - m.timestamp < SPAM_INTERVAL);

  if (userSpam.messages.length >= SPAM_THRESHOLD) {

    for (const msg of userSpam.messages) {
      try {
        const channel = await client.channels.fetch(msg.channelId);
        const spamMsg = await channel.messages.fetch(msg.messageId).catch(() => null);
        if (spamMsg) await spamMsg.delete().catch(() => { });
      } catch { }
    }


    if (!userSpam.warned) {
      userSpam.warned = true;


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
        .setColor(config.embedColor).setDescription(`⚠️ <@${userId}>: you have been warned for **spamming** (${warnDoc.warnings.length} total warnings)`);
      await message.channel.send({ embeds: [warnEmbed] }).catch(() => { });


      setTimeout(() => {
        if (client.spamTracker.has(userId)) {
          client.spamTracker.get(userId).warned = false;
        }
      }, 10000);
    }

    userSpam.messages = [];
    return;
  }


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
      .setColor(config.embedColor).setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 512 }))
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


    const targetChannel = guildSettings?.levelChannel
      ? message.guild.channels.cache.get(guildSettings.levelChannel) || message.channel
      : message.channel;

    await targetChannel.send({ embeds: [levelEmbed] }).catch(() => { });
  }

  await userData.save();


  const afkUser = await AFK.findOne({ userID: message.author.id });
  if (afkUser) {
    await AFK.deleteOne({ userID: message.author.id });
    const afkEmbed = new MessageEmbed()
      .setColor(config.embedColor).setDescription(`> 💤 **${message.author}**: welcome back! I removed your AFK status.`);
    message.channel.send({ embeds: [afkEmbed] });
  }

  for (const mentioned of message.mentions.members.values()) {
    const mentionedAFK = await AFK.findOne({ userID: mentioned.id });
    if (mentionedAFK) {
      const unixTimestamp = Math.floor(mentionedAFK.timestamp.getTime() / 1000);
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`> 💤 **${mentioned.user.username}**: is currently AFK (${mentionedAFK.reason || "n/a"})`);
      message.channel.send({ embeds: [embed] });
    }
  }


  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);
    if (!command) return;


    const isBlacklisted = await Blacklist.findOne({ userId: message.author.id });
    if (isBlacklisted) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor).setDescription(`🚫 <@${message.author.id}>: you are blacklisted from using this bot.`);
      return message.reply({ embeds: [embed] });
    }

    try {
      await command.execute(client, message, args);
    } catch (error) {
      console.error(error);
      message.reply("*sorry, something went wrong running that command.*");
    }
    return;
  }

});


client.on("channelCreate", async (channel) => {
  if (!channel.guild) return;

  const auditLogs = await channel.guild.fetchAuditLogs({ type: "CHANNEL_CREATE", limit: 1 }).catch(() => null);
  if (!auditLogs) return;

  const entry = auditLogs.entries.first();
  if (!entry || entry.executor.id === channel.guild.ownerId) return;
  if (entry.executor.id === client.user.id) return;

  const executorId = entry.executor.id;
  const isBot = entry.executor.bot;
  const now = Date.now();

  if (!client.nukeTracker.has(executorId)) {
    client.nukeTracker.set(executorId, { channelDeletes: [], channelCreates: [], roleDeletes: [], bans: [] });
  }

  const tracker = client.nukeTracker.get(executorId);
  if (!tracker.channelCreates) tracker.channelCreates = [];
  tracker.channelCreates.push({ time: now, channelId: channel.id });
  tracker.channelCreates = tracker.channelCreates.filter(t => now - t.time < NUKE_INTERVAL);

  if (tracker.channelCreates.length >= NUKE_THRESHOLD) {
    const count = tracker.channelCreates.length;
    const seconds = Math.round(NUKE_INTERVAL / 1000);

    for (const c of tracker.channelCreates) {
      const spamChannel = channel.guild.channels.cache.get(c.channelId);
      if (spamChannel) await spamChannel.delete().catch(() => { });
    }

    if (isBot) {
      await channel.guild.members.ban(executorId, { reason: "Antinuke: mass channel creation" }).catch(() => { });
    } else {
      const member = await channel.guild.members.fetch(executorId).catch(() => null);
      if (member) {
        for (const role of member.roles.cache.values()) {
          if (role.permissions.has("ADMINISTRATOR") || role.permissions.has("MANAGE_CHANNELS") || role.permissions.has("MANAGE_GUILD")) {
            await member.roles.remove(role).catch(() => { });
          }
        }
      }
    }

    const owner = await channel.guild.fetchOwner().catch(() => null);
    if (owner) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor)
        .setDescription(`> 🛡️ <@${executorId}>: was ${isBot ? "**banned**" : "stripped of permissions"} for creating **${count} channels** in **${seconds}s** in **${channel.guild.name}**.`);
      await owner.send({ embeds: [embed] }).catch(() => { });
    }
    tracker.channelCreates = [];
  }
});


client.on("channelDelete", async (channel) => {
  if (!channel.guild) return;

  const auditLogs = await channel.guild.fetchAuditLogs({ type: "CHANNEL_DELETE", limit: 1 }).catch(() => null);
  if (!auditLogs) return;

  const entry = auditLogs.entries.first();
  if (!entry || entry.executor.id === channel.guild.ownerId) return;
  if (entry.executor.id === client.user.id) return;

  const executorId = entry.executor.id;
  const isBot = entry.executor.bot;
  const now = Date.now();

  if (!client.nukeTracker.has(executorId)) {
    client.nukeTracker.set(executorId, { channelDeletes: [], channelCreates: [], roleDeletes: [], bans: [] });
  }

  const tracker = client.nukeTracker.get(executorId);
  tracker.channelDeletes.push(now);
  tracker.channelDeletes = tracker.channelDeletes.filter(t => now - t < NUKE_INTERVAL);

  if (tracker.channelDeletes.length >= NUKE_THRESHOLD) {
    const count = tracker.channelDeletes.length;
    const seconds = Math.round(NUKE_INTERVAL / 1000);

    if (isBot) {
      await channel.guild.members.ban(executorId, { reason: "Antinuke: mass channel deletion" }).catch(() => { });
    } else {
      const member = await channel.guild.members.fetch(executorId).catch(() => null);
      if (member) {
        for (const role of member.roles.cache.values()) {
          if (role.permissions.has("ADMINISTRATOR") || role.permissions.has("MANAGE_CHANNELS") || role.permissions.has("MANAGE_GUILD")) {
            await member.roles.remove(role).catch(() => { });
          }
        }
      }
    }

    const owner = await channel.guild.fetchOwner().catch(() => null);
    if (owner) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor)
        .setDescription(`> 🛡️ <@${executorId}>: was ${isBot ? "**banned**" : "stripped of permissions"} for deleting **${count} channels** in **${seconds}s** in **${channel.guild.name}**.`);
      await owner.send({ embeds: [embed] }).catch(() => { });
    }
    tracker.channelDeletes = [];
  }
});

client.on("roleDelete", async (role) => {
  const auditLogs = await role.guild.fetchAuditLogs({ type: "ROLE_DELETE", limit: 1 }).catch(() => null);
  if (!auditLogs) return;

  const entry = auditLogs.entries.first();
  if (!entry || entry.executor.id === role.guild.ownerId) return;
  if (entry.executor.id === client.user.id) return;

  const executorId = entry.executor.id;
  const isBot = entry.executor.bot;
  const now = Date.now();

  if (!client.nukeTracker.has(executorId)) {
    client.nukeTracker.set(executorId, { channelDeletes: [], channelCreates: [], roleDeletes: [], bans: [] });
  }

  const tracker = client.nukeTracker.get(executorId);
  tracker.roleDeletes.push(now);
  tracker.roleDeletes = tracker.roleDeletes.filter(t => now - t < NUKE_INTERVAL);

  if (tracker.roleDeletes.length >= NUKE_THRESHOLD) {
    const count = tracker.roleDeletes.length;
    const seconds = Math.round(NUKE_INTERVAL / 1000);

    if (isBot) {
      await role.guild.members.ban(executorId, { reason: "Antinuke: mass role deletion" }).catch(() => { });
    } else {
      const member = await role.guild.members.fetch(executorId).catch(() => null);
      if (member) {
        for (const r of member.roles.cache.values()) {
          if (r.permissions.has("ADMINISTRATOR") || r.permissions.has("MANAGE_ROLES") || r.permissions.has("MANAGE_GUILD")) {
            await member.roles.remove(r).catch(() => { });
          }
        }
      }
    }

    const owner = await role.guild.fetchOwner().catch(() => null);
    if (owner) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor)
        .setDescription(`> 🛡️ <@${executorId}>: was ${isBot ? "**banned**" : "stripped of permissions"} for deleting **${count} roles** in **${seconds}s** in **${role.guild.name}**.`);
      await owner.send({ embeds: [embed] }).catch(() => { });
    }
    tracker.roleDeletes = [];
  }
});

client.on("guildBanAdd", async (ban) => {
  const auditLogs = await ban.guild.fetchAuditLogs({ type: "MEMBER_BAN_ADD", limit: 1 }).catch(() => null);
  if (!auditLogs) return;

  const entry = auditLogs.entries.first();
  if (!entry || entry.executor.id === ban.guild.ownerId) return;
  if (entry.executor.id === client.user.id) return;

  const executorId = entry.executor.id;
  const isBot = entry.executor.bot;
  const now = Date.now();

  if (!client.nukeTracker.has(executorId)) {
    client.nukeTracker.set(executorId, { channelDeletes: [], channelCreates: [], roleDeletes: [], bans: [] });
  }

  const tracker = client.nukeTracker.get(executorId);
  tracker.bans.push(now);
  tracker.bans = tracker.bans.filter(t => now - t < NUKE_INTERVAL);

  if (tracker.bans.length >= NUKE_THRESHOLD) {
    const count = tracker.bans.length;
    const seconds = Math.round(NUKE_INTERVAL / 1000);

    if (isBot) {
      await ban.guild.members.ban(executorId, { reason: "Antinuke: mass banning" }).catch(() => { });
    } else {
      const member = await ban.guild.members.fetch(executorId).catch(() => null);
      if (member) {
        for (const role of member.roles.cache.values()) {
          if (role.permissions.has("ADMINISTRATOR") || role.permissions.has("BAN_MEMBERS") || role.permissions.has("KICK_MEMBERS")) {
            await member.roles.remove(role).catch(() => { });
          }
        }
      }
    }

    const owner = await ban.guild.fetchOwner().catch(() => null);
    if (owner) {
      const embed = new MessageEmbed()
        .setColor(config.embedColor)
        .setDescription(`> 🛡️ <@${executorId}>: was ${isBot ? "**banned**" : "stripped of permissions"} for banning **${count} members** in **${seconds}s** in **${ban.guild.name}**.`);
      await owner.send({ embeds: [embed] }).catch(() => { });
    }
    tracker.bans = [];
  }
});

if (!process.env.DISCORD_TOKEN) {
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN)
  .catch(() => process.exit(1));


const express = require("express");
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT);


async function resetCount(message, countData, reason) {
  await message.reply(reason);
  countData.currentNumber = 1;
  countData.lastUserId = null;
  await countData.save();
}

