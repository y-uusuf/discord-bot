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

const Count = require("./models/count");

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
  console.error("FATAL: DISCORD_TOKEN is not set in the environment variables.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN)
  .catch((err) => {
    console.error("FATAL: Failed to login to Discord.", err);
    process.exit(1);
  });


const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());

app.get("/", (req, res) => res.send("Bot is running!"));

app.get("/api/stats", (req, res) => {
  const formatUptime = (ms) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  res.json({
    uptime: formatUptime(client.uptime),
    uptimeMs: client.uptime,
    guilds: client.guilds.cache.size,
    users: client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
    ping: client.ws.ping,
    avatar: client.user.displayAvatarURL({ dynamic: true, size: 512 })
  });
});

app.get("/api/commands", (req, res) => {
  const commands = [];
  client.commands.forEach((cmd) => {
    if (!commands.find(c => c.name === cmd.name)) {
      commands.push({
        name: cmd.name,
        aliases: cmd.aliases || [],
        description: cmd.description || "No description provided."
      });
    }
  });
  res.json(commands);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);




