const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const config = require("../../config.json");
const fs = require("fs");
const path = require("path");

// Default activity from config
const defaultActivity = {
    name: config.activityName,
    type: config.activityType,
    status: config.activityStatus
};

module.exports = {
    name: "activity",
    description: "Change bot activity (owner only)",
    aliases: ["status"],
    async execute(client, message, args) {
        // Check if user is bot owner
        const app = await client.application.fetch();
        if (message.author.id !== app.owner?.id && message.author.id !== app.owner?.ownerId) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`❌ <@${message.author.id}>: only the bot owner can use this command.`);
            return message.reply({ embeds: [embed] });
        }

        const status = args[0]?.toLowerCase();
        const activityName = args.slice(1).join(" ");

        // No args - reset to default or show current
        if (!status) {
            const currentPresence = client.user.presence;
            const isDefault = currentPresence.activities[0]?.name === defaultActivity.name;

            if (isDefault) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`> ⚙️ <@${message.author.id}>: activity is already set to default.`);
                return message.reply({ embeds: [embed] });
            }

            // Reset to default
            client.user.setPresence({
                activities: [{ name: defaultActivity.name, type: defaultActivity.type }],
                status: defaultActivity.status
            });

            return message.react("👍");
        }

        // Validate status
        const validStatuses = ["online", "idle", "dnd", "invisible"];
        if (!validStatuses.includes(status)) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`❌ <@${message.author.id}>: invalid status. use: online, idle, dnd, invisible`);
            return message.reply({ embeds: [embed] });
        }

        if (!activityName) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`❌ <@${message.author.id}>: usage: \`,activity <status> <name>\``);
            return message.reply({ embeds: [embed] });
        }

        // Show confirmation
        const embed = new MessageEmbed()
            .setColor(config.embedColor)
            .setDescription(`> ⚙️ <@${message.author.id}>: set activity to **${status}** with name **${activityName}**?`);

        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId(`activity_confirm_${status}_${message.author.id}`).setLabel("Confirm").setStyle("SUCCESS"),
            new MessageButton().setCustomId(`activity_cancel_${message.author.id}`).setLabel("Cancel").setStyle("DANGER")
        );

        const reply = await message.reply({ embeds: [embed], components: [row] });

        // Store the activity name for the button handler
        client.pendingActivity = client.pendingActivity || new Map();
        client.pendingActivity.set(message.author.id, { status, name: activityName, messageId: reply.id });

        // Auto-cleanup after 30 seconds
        setTimeout(() => {
            client.pendingActivity?.delete(message.author.id);
        }, 30000);
    }
};
