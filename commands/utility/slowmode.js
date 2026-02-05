const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require("discord.js");
const config = require("../../config.json");

module.exports = {
    name: "slowmode",
    aliases: ["sm"],
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_CHANNELS")) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you are missing **Manage Channels** permission(s) to run this command`);
            return message.reply({ embeds: [embed] });
        }

        const options = [
            { label: "Off", value: "0", description: "Disable slowmode" },
            { label: "5 seconds", value: "5", description: "5 second cooldown" },
            { label: "10 seconds", value: "10", description: "10 second cooldown" },
            { label: "15 seconds", value: "15", description: "15 second cooldown" },
            { label: "30 seconds", value: "30", description: "30 second cooldown" },
            { label: "1 minute", value: "60", description: "1 minute cooldown" },
            { label: "2 minutes", value: "120", description: "2 minute cooldown" },
            { label: "5 minutes", value: "300", description: "5 minute cooldown" },
            { label: "10 minutes", value: "600", description: "10 minute cooldown" },
            { label: "15 minutes", value: "900", description: "15 minute cooldown" },
            { label: "30 minutes", value: "1800", description: "30 minute cooldown" },
            { label: "1 hour", value: "3600", description: "1 hour cooldown" },
            { label: "2 hours", value: "7200", description: "2 hour cooldown" },
            { label: "6 hours", value: "21600", description: "6 hour cooldown (max)" },
        ];

        const selectMenu = new MessageSelectMenu()
            .setCustomId("slowmode_select")
            .setPlaceholder("Select slowmode duration...")
            .addOptions(options);

        const row = new MessageActionRow().addComponents(selectMenu);

        const embed = new MessageEmbed()
            .setColor(config.embedColor).setDescription(`🐌 <@${message.author.id}>: select slowmode duration to apply to **all channels**`);

        const reply = await message.reply({ embeds: [embed], components: [row] });

        const filter = i => i.user.id === message.author.id && i.customId === "slowmode_select";
        let selectInteraction;

        try {
            selectInteraction = await reply.awaitMessageComponent({ filter, time: 30000 });
        } catch {
            const timeoutEmbed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`⏰ <@${message.author.id}>: timed out`);
            return reply.edit({ embeds: [timeoutEmbed], components: [] });
        }

        const selectedValue = parseInt(selectInteraction.values[0]);
        const selectedLabel = options.find(o => o.value === selectInteraction.values[0]).label;

        
        const textChannels = message.guild.channels.cache.filter(
            c => c.type === "GUILD_TEXT" || c.type === "GUILD_NEWS"
        );

        
        const allMatch = textChannels.every(c => c.rateLimitPerUser === selectedValue);

        if (allMatch) {
            const alreadyEmbed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: all channels already have slowmode set to **${selectedLabel}**`);
            return selectInteraction.update({ embeds: [alreadyEmbed], components: [] });
        }

        
        const confirmEmbed = new MessageEmbed()
            .setColor(config.embedColor).setDescription(`⚠️ <@${message.author.id}>: set slowmode to **${selectedLabel}** for **${textChannels.size}** channels?`);

        const confirmRow = new MessageActionRow().addComponents(
            new MessageButton().setCustomId("slowmode_confirm").setLabel("Confirm").setStyle("DANGER"),
            new MessageButton().setCustomId("slowmode_cancel").setLabel("Cancel").setStyle("SECONDARY")
        );

        await selectInteraction.update({ embeds: [confirmEmbed], components: [confirmRow] });

        const btnFilter = i => i.user.id === message.author.id && ["slowmode_confirm", "slowmode_cancel"].includes(i.customId);
        let btnInteraction;

        try {
            btnInteraction = await reply.awaitMessageComponent({ filter: btnFilter, time: 15000 });
        } catch {
            const timeoutEmbed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`⏰ <@${message.author.id}>: timed out`);
            return reply.edit({ embeds: [timeoutEmbed], components: [] });
        }

        if (btnInteraction.customId === "slowmode_cancel") {
            const cancelEmbed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: cancelled`);
            return btnInteraction.update({ embeds: [cancelEmbed], components: [] });
        }

        
        await btnInteraction.update({ content: "👍", embeds: [], components: [] });

        let success = 0;
        let failed = 0;

        for (const [, channel] of textChannels) {
            try {
                await channel.setRateLimitPerUser(selectedValue);
                success++;
            } catch {
                failed++;
            }
        }

        const resultEmbed = new MessageEmbed()
            .setColor(config.embedColor).setDescription(`🐌 <@${message.author.id}>: set slowmode to **${selectedLabel}** for **${success}** channels${failed > 0 ? ` (${failed} failed)` : ""}`);

        await message.channel.send({ embeds: [resultEmbed] });
    },
};
