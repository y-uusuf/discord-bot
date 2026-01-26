const { WebhookClient, MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const Settings = require("../../models/settings");

module.exports = {
    name: "hook",
    description: "Send messages via webhook or manage saved webhooks.",
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_WEBHOOKS")) {
            return message.reply("*sorry, you need 'Manage Webhooks' permission to use this.*");
        }

        const sub = args[0]?.toLowerCase();

        // --- ADD WEBHOOK ---
        if (sub === "add") {
            const name = args[1];
            const url = args[2];

            if (!name || !url) {
                return message.reply("*usage: `,hook add <name> <url>`*");
            }
            if (!url.startsWith("http")) {
                return message.reply("*please provide a valid webhook URL.*");
            }
            if (["add", "remove", "list"].includes(name.toLowerCase())) {
                return message.reply("*that name is reserved.*");
            }

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { [`savedWebhooks.${name.toLowerCase()}`]: url },
                { upsert: true }
            );

            return message.reply(`*saved webhook as **${name.toLowerCase()}**.*`);
        }

        // --- REMOVE WEBHOOK ---
        if (sub === "remove") {
            const name = args[1];
            if (!name) return message.reply("*usage: `,hook remove <name>`*");

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { $unset: { [`savedWebhooks.${name.toLowerCase()}`]: "" } },
                { upsert: true }
            );

            return message.reply(`*removed webhook **${name.toLowerCase()}**.*`);
        }

        // --- LIST WEBHOOKS ---
        if (sub === "list") {
            const settings = await Settings.findOne({ guildId: message.guild.id });
            const webhooks = settings?.savedWebhooks;

            if (!webhooks || webhooks.size === 0) {
                return message.reply("*no saved webhooks.*");
            }

            // Convert Map to array keys
            const keys = Array.from(webhooks.keys());
            const list = keys.map(k => `\`${k}\``).join(", ");

            const embed = new MessageEmbed()
                .setTitle("saved webhooks")
                .setDescription(list)

            return message.reply({ embeds: [embed] });
        }

        // --- SEND MESSAGE ---
        let url = args[0];
        let content = args.slice(1).join(" ");
        let usedSaved = false;

        // Check if arg[0] is a saved name
        if (url && !url.startsWith("http")) {
            const settings = await Settings.findOne({ guildId: message.guild.id });
            if (settings?.savedWebhooks?.has(url.toLowerCase())) {
                url = settings.savedWebhooks.get(url.toLowerCase());
                usedSaved = true;
            }
        }

        if (!url || !content || (!url.startsWith("http") && !usedSaved)) {
            const embed = new MessageEmbed()
                .setTitle("hook command")
                .setDescription("*send messages via webhook.*")
                .addFields(
                    { name: "```usage```", value: "`,hook <url/name> <message>`", inline: false },
                    { name: "```manage```", value: "`,hook add <name> <url>`\n`,hook remove <name>`\n`,hook list`", inline: false },
                    { name: "```examples```", value: "`,hook myhook hello!`\n`,hook https://... hello!`", inline: false }
                );
            return message.reply({ embeds: [embed] });
        }

        // Prompt for format
        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId("hook_embed").setLabel("Embed").setStyle("PRIMARY"),
            new MessageButton().setCustomId("hook_raw").setLabel("Raw Text").setStyle("SECONDARY")
        );

        const prompt = await message.reply({
            content: "*how should this message be sent?*",
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
        // Delete command message if possible/desired
        message.delete().catch(() => { });

        try {
            const webhook = new WebhookClient({ url });
            const payload = {
                username: "HOOK_NAME", // Placeholder? User requested "." before. I should use "."?
                // Step 573: "makje it the server pfp as the hook pfp and "." as the name"
                // So I recall that logic.
                username: ".",
                avatarURL: message.guild.iconURL({ dynamic: true }) || message.author.displayAvatarURL({ dynamic: true })
            };

            if (interaction.customId === "hook_embed") {
                const embed = new MessageEmbed().setDescription(content);
                // Colorless embed as requested in Step 573 ("embed the message no colour") 
                // But wait, Step 634 requested "change to no colour" for INVITE command. 
                // But Step 573 requested "no colour" for HOOK too.
                // I will leave it colorless (default).
                payload.embeds = [embed];
            } else {
                payload.content = content;
            }

            await webhook.send(payload);
        } catch (e) {
            console.error(e);
            message.channel.send("*invalid webhook URL or missing permissions.*").then(m => setTimeout(() => m.delete(), 5000));
        }
    }
};
