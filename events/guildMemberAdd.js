const { MessageEmbed, WebhookClient } = require("discord.js");
const config = require("../config.json");
const Webhook = require("../models/webhook");
const Settings = require("../models/settings");

module.exports = {
    name: "guildMemberAdd",
    async execute(member, client) {

        const embed = new MessageEmbed()
            .setColor(config.embedColor).setAuthor({ name: `/2ks`, iconURL: "https://media3.giphy.com/media/v1.Y2lkPTZjMDliOTUydHJ4aDJpc2dmbW5wamxvOG9xdGk1bGZqa2N5MTN6bTRhOGd0bWg5YyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/JZ3sDHgd48Dao/200.gif" })
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setDescription(`wlc ${member.user.username} to [/2ks.](https://discord.gg/2ks) 🕸`)
            .setFooter({ text: `${member.guild.memberCount} members.` })
            .setTimestamp();

        try {
            const webhookConfig = await Webhook.findOne({ guildId: member.guild.id });
            const settingsConfig = await Settings.findOne({ guildId: member.guild.id });

            
            if (webhookConfig?.welcome?.id && webhookConfig?.welcome?.token) {
                const webhook = new WebhookClient({
                    id: webhookConfig.welcome.id,
                    token: webhookConfig.welcome.token,
                });
                await webhook.send({ content: `<@${member.user.id}>`, embeds: [embed] });
            }
            else if (settingsConfig?.welcomeChannel) {
                const welcomeChannel = await client.channels.fetch(settingsConfig.welcomeChannel).catch(() => null);
                if (welcomeChannel) await welcomeChannel.send({ content: `<@${member.user.id}>`, embeds: [embed] });
            }
            else {
                client.channels.fetch("1198671834871251004").then(ch => ch.send({ content: `<@${member.user.id}>`, embeds: [embed] })).catch(() => { });
            }
        } catch (err) {
            console.error("Error sending welcome message:", err);
        }
    }
};
