const { MessageEmbed } = require("discord.js");
const config = require("../config.json");
const Settings = require("../models/settings");
const Blacklist = require("../models/blacklist");
const Warn = require("../models/warn");
const Level = require("../models/level");
const AFK = require("../models/afk");
const Count = require("../models/count");

const SPAM_THRESHOLD = 5;
const SPAM_INTERVAL = 3000;

module.exports = {
    name: "messageCreate",
    async execute(message, client) {
        if (message.author.bot) return;

        const guildSettings = message.guild ? await Settings.findOne({ guildId: message.guild.id }) : null;
        const prefix = guildSettings?.prefix || config.prefix;
        const isCountingChannel = guildSettings?.countingChannel && message.channel.id === guildSettings.countingChannel;
        const isTrialChannel = guildSettings?.trialChannel && message.channel.id === guildSettings.trialChannel;

        // Auto Reacts
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

        // Trial Channel Check
        if (isTrialChannel && !client.trialActive?.has(message.guild.id)) {
            await message.delete().catch(() => { });
            return;
        }

        // Counting Channel Logic
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

        // Easter Egg
        if (message.content.includes("https://cdn.discordapp.com/attachments/1198671834871251004/1402793329095086242/issa.gif")) {
            return message.reply("<@801125402927824918>").then(m => m.react('😭'));
        }

        // DM Handling
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

        // Spam Tracker
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

        // Leveling System
        const userID = message.author.id;
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

        // AFK Check
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
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`> 💤 **${mentioned.user.username}**: is currently AFK (${mentionedAFK.reason || "n/a"})`);
                message.channel.send({ embeds: [embed] });
            }
        }

        // Command Handling
        if (message.content.startsWith(prefix)) {
            const args = message.content.slice(prefix.length).trim().split(/ +/);
            const commandName = args.shift().toLowerCase();
            const command = client.commands.get(commandName);
            if (!command) return;

            // Global DJ Check
            if (command.category === "music") {
                if (message.author.id !== message.guild.ownerId) {
                    const settings = await Settings.findOne({ guildId: message.guild.id });
                    if (settings && settings.djRole) {
                        const djRole = message.guild.roles.cache.get(settings.djRole);
                        if (djRole) {
                            const hasRole = message.member.roles.cache.has(settings.djRole);
                            const hasHigher = message.member.roles.highest.comparePositionTo(djRole) >= 0;

                            if (!hasRole && !hasHigher) {
                                const embed = new MessageEmbed()
                                    .setColor(config.embedColor)
                                    .setDescription(`❌ <@${message.author.id}>: you need the <@&${settings.djRole}> role or higher to use this command.`);
                                return message.reply({ embeds: [embed] });
                            }
                        }
                    }
                }
            }

            // Blacklist Check
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
                console.error(error);
                message.reply("*sorry, something went wrong running that command.*").catch(() => { });
            }
            return;
        }
    }
};

async function resetCount(message, countData, reason) {
    await message.reply(reason);
    countData.currentNumber = 1;
    countData.lastUserId = null;
    await countData.save();
}
