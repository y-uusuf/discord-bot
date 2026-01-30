const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require("discord.js");
const config = require("../../config.json");
const Settings = require("../../models/settings");

module.exports = {
    name: 'confess',
    async execute(client, message, args) {
        
        if (message.guild) {
            await message.delete().catch(() => { });
            try {
                await message.author.send("you can't confess here. please DM me your confession to remain anonymous.");
            } catch (e) {
                
            }
            return;
        }

        
        if (!args.length) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                .setDescription("send an anonymous confession to the server.")
                .addFields(
                    { name: "```usage```", value: "`,confess <message>`", inline: false },
                    { name: "```examples```", value: "`,confess i love pizza`", inline: false }
                );
            return message.reply({ embeds: [embed] });
        }

        const confession = args.join(' ');

        
        const availableGuilds = [];
        for (const [id, g] of client.guilds.cache) {
            try {
                const member = await g.members.fetch(message.author.id).catch(() => null);
                if (member) {
                    const s = await Settings.findOne({ guildId: id });
                    if (s && s.confessChannel) {
                        availableGuilds.push(g);
                    }
                }
            } catch (e) { continue; }
        }

        if (availableGuilds.length === 0) {
            return message.reply("sorry, i couldn't find any common servers with confession channels configured.");
        }

        let guild;

        
        if (availableGuilds.length > 1) {
            const row = new MessageActionRow()
                .addComponents(
                    new MessageSelectMenu()
                        .setCustomId('confess_guild_select')
                        .setPlaceholder('Select a server')
                        .addOptions(availableGuilds.map(g => ({
                            label: g.name,
                            description: `Send confession to ${g.name}`,
                            value: g.id
                        })))
                );

            const prompt = await message.reply({
                content: "you are in multiple servers with me. please select where to send this confession:",
                components: [row]
            });

            const filter = i => i.customId === 'confess_guild_select' && i.user.id === message.author.id;
            try {
                const interaction = await prompt.awaitMessageComponent({ filter, time: 30000 });
                guild = client.guilds.cache.get(interaction.values[0]);

                
                await interaction.update({
                    content: `selected **${guild.name}**. sending confession...`,
                    components: []
                });

            } catch (err) {
                return prompt.edit({ content: "selection timed out. confession cancelled.", components: [] });
            }
        } else {
            guild = availableGuilds[0];
        }

        if (!guild) return; 

        
        const settings = await Settings.findOne({ guildId: guild.id });
        if (!settings || !settings.confessChannel) {
            return message.reply(`confessions are not configured for **${guild.name}**. ask an admin to set a confess channel.`);
        }

        const channel = await guild.channels.fetch(settings.confessChannel).catch(() => null);
        if (!channel) {
            return message.reply("the configured confession channel no longer exists.");
        }

        
        let webhook;
        try {
            const webhooks = await channel.fetchWebhooks();
            webhook = webhooks.find(w => w.name === ',confess');

            if (!webhook) {
                webhook = await channel.createWebhook(',confess', {
                    avatar: client.user.displayAvatarURL(),
                });
            }
        } catch (err) {
            console.error("Webhook Error:", err);
            return message.reply("failed to manage webhooks for confession (missing permissions?).");
        }

        
        const embed = new MessageEmbed()
            .setColor(config.embedColor).setAuthor({ name: "someone has made a confession." })
            .setDescription(`"__${confession}__"`)
            .setFooter({ text: "sent anonymously via DMs // do the same with \",confess\"." })
            .setTimestamp();

        try {
            await webhook.send({
                username: client.user.username,
                avatarURL: client.user.displayAvatarURL(),
                embeds: [embed]
            });

            
            await message.reply(`your confession has been sent anonymously to **${guild.name}**!`);

        } catch (err) {
            console.error("Send Error:", err);
            message.reply("failed to send confession.");
        }
    }
};