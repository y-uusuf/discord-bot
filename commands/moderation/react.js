const { MessageEmbed } = require("discord.js");
const Settings = require("../../models/settings");

module.exports = {
    name: "react",
    async execute(client, message, args) {
        if (!message.member.permissions.has("ADMINISTRATOR")) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: you are missing **Administrator** permission(s) to run this command`);
            return message.reply({ embeds: [embed] });
        }

        const action = args[0]?.toLowerCase();

        if (!action || !["add", "remove", "list"].includes(action)) {
            const embed = new MessageEmbed()
                .setDescription(`😀 <@${message.author.id}>: manage auto-reactions (or text responses) for specific words.\n\n**usage:**\n\`,react add <trigger> <emoji/text>\`\n\`,react remove <trigger>\`\n\`,react list\``);
            return message.reply({ embeds: [embed] });
        }

        const settings = await Settings.findOne({ guildId: message.guild.id });

        if (action === "list") {
            if (!settings?.autoReacts || settings.autoReacts.size === 0) {
                const embed = new MessageEmbed()
                    .setDescription(`📋 <@${message.author.id}>: no auto-reactions configured`);
                return message.reply({ embeds: [embed] });
            }

            const list = Array.from(settings.autoReacts.entries())
                .map(([trigger, emoji]) => `\`${trigger}\` → ${emoji}`)
                .join("\n");

            const embed = new MessageEmbed()
                .setDescription(`📋 <@${message.author.id}>: auto-reactions\n\n${list}`);

            return message.reply({ embeds: [embed] });
        }

        if (action === "add") {
            const trigger = args[1]?.toLowerCase();
            const emoji = args.slice(2).join(" ");

            if (!trigger || !emoji) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: please provide a trigger word and emoji`);
                return message.reply({ embeds: [embed] });
            }

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { $set: { [`autoReacts.${trigger}`]: emoji } },
                { upsert: true }
            );

            const embed = new MessageEmbed()
                .setDescription(`😀 <@${message.author.id}>: added auto-reaction: \`${trigger}\` → ${emoji}`);
            return message.reply({ embeds: [embed] });
        }

        if (action === "remove") {
            const trigger = args[1]?.toLowerCase();

            if (!trigger) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: please provide the trigger word to remove`);
                return message.reply({ embeds: [embed] });
            }

            if (!settings?.autoReacts?.has(trigger)) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: no auto-reaction found for \`${trigger}\``);
                return message.reply({ embeds: [embed] });
            }

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { $unset: { [`autoReacts.${trigger}`]: "" } }
            );

            const embed = new MessageEmbed()
                .setDescription(`😀 <@${message.author.id}>: removed auto-reaction for \`${trigger}\``);
            return message.reply({ embeds: [embed] });
        }
    },
};
