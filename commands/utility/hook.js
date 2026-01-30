const { WebhookClient, MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const config = require("../../config.json");
const Settings = require("../../models/settings");

module.exports = {
    name: "hook",
    description: "Send messages via webhook or manage saved webhooks.",
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_WEBHOOKS")) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you are missing **Manage Webhooks** permission(s) to run this command`);
            return message.reply({ embeds: [embed] });
        }

        const sub = args[0]?.toLowerCase();

        
        if (sub === "add") {
            const name = args[1];
            const url = args[2];

            if (!name || !url) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: usage: \`,hook add <name> <url>\``);
                return message.reply({ embeds: [embed] });
            }
            if (!url.startsWith("http")) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please provide a valid webhook URL`);
                return message.reply({ embeds: [embed] });
            }
            if (["add", "remove", "list"].includes(name.toLowerCase())) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: that name is reserved`);
                return message.reply({ embeds: [embed] });
            }

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { [`savedWebhooks.${name.toLowerCase()}`]: url },
                { upsert: true }
            );

            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`🪝 <@${message.author.id}>: saved webhook as **${name.toLowerCase()}**`);
            return message.reply({ embeds: [embed] });
        }

        
        if (sub === "remove") {
            const name = args[1];
            if (!name) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: usage: \`,hook remove <name>\``);
                return message.reply({ embeds: [embed] });
            }

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { $unset: { [`savedWebhooks.${name.toLowerCase()}`]: "" } },
                { upsert: true }
            );

            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`🪝 <@${message.author.id}>: removed webhook **${name.toLowerCase()}**`);
            return message.reply({ embeds: [embed] });
        }

        
        if (sub === "list") {
            const settings = await Settings.findOne({ guildId: message.guild.id });
            const webhooks = settings?.savedWebhooks;

            if (!webhooks || webhooks.size === 0) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`📋 <@${message.author.id}>: no saved webhooks`);
                return message.reply({ embeds: [embed] });
            }

            const keys = Array.from(webhooks.keys());
            const list = keys.map(k => `\`${k}\``).join(", ");

            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`📋 <@${message.author.id}>: saved webhooks: ${list}`);

            return message.reply({ embeds: [embed] });
        }

        
        let url = args[0];
        let content = args.slice(1).join(" ");
        let usedSaved = false;

        if (url && !url.startsWith("http")) {
            const settings = await Settings.findOne({ guildId: message.guild.id });
            if (settings?.savedWebhooks?.has(url.toLowerCase())) {
                url = settings.savedWebhooks.get(url.toLowerCase());
                usedSaved = true;
            }
        }

        if (!url || !content || (!url.startsWith("http") && !usedSaved)) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`🪝 <@${message.author.id}>: send messages via webhook.\n\n**usage:** \`,hook <url/name> <message>\`\n**manage:** \`,hook add/remove/list\``);
            return message.reply({ embeds: [embed] });
        }

        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId("hook_embed").setLabel("Embed").setStyle("PRIMARY"),
            new MessageButton().setCustomId("hook_raw").setLabel("Raw Text").setStyle("SECONDARY")
        );

        const prompt = await message.reply({
            embeds: [new MessageEmbed().setColor(config.embedColor).setDescription(`🪝 <@${message.author.id}>: how should this message be sent?`)],
            components: [row]
        });

        const filter = i => i.user.id === message.author.id && ["hook_embed", "hook_raw"].includes(i.customId);
        let interaction;

        try {
            interaction = await prompt.awaitMessageComponent({ filter, time: 15000 });
        } catch {
            return prompt.delete().catch(() => { });
        }

        await interaction.deferUpdate();
        prompt.delete().catch(() => { });
        message.delete().catch(() => { });

        try {
            const webhook = new WebhookClient({ url });
            const payload = {
                username: ".",
                avatarURL: message.guild.iconURL({ dynamic: true })
            };

            if (interaction.customId === "hook_embed") {
                const embed = new MessageEmbed().setColor(config.embedColor).setDescription(content);
                payload.embeds = [embed];
            } else {
                payload.content = content;
            }

            await webhook.send(payload);
        } catch (e) {
            console.error(e);
            const errEmbed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: invalid webhook URL or missing permissions`);
            message.channel.send({ embeds: [errEmbed] }).then(m => setTimeout(() => m.delete(), 5000));
        }
    }
};
