const { MessageEmbed } = require("discord.js");
const Settings = require("../../models/settings");

module.exports = {
    name: "react",
    async execute(client, message, args) {
        if (!message.member.permissions.has("ADMINISTRATOR")) {
            return message.reply("*sorry, you need administrator permission to use this command.*");
        }

        const action = args[0]?.toLowerCase();

        if (!action || !["add", "remove", "list"].includes(action)) {
            const embed = new MessageEmbed()
                .setTitle("react command")
                .setDescription("*manage auto-reactions for specific words.*")
                .addFields(
                    { name: "```usage```", value: "`,react add <trigger> <emoji>`\n`,react remove <trigger>`\n`,react list`", inline: false },
                    { name: "```examples```", value: "`,react add sob 😭`\n`,react remove sob`", inline: false }
                );
            return message.reply({ embeds: [embed] });
        }

        const settings = await Settings.findOne({ guildId: message.guild.id });

        if (action === "list") {
            if (!settings?.autoReacts || settings.autoReacts.size === 0) {
                return message.reply("*no auto-reactions configured.*");
            }

            const list = Array.from(settings.autoReacts.entries())
                .map(([trigger, emoji]) => `\`${trigger}\` → ${emoji}`)
                .join("\n");

            const embed = new MessageEmbed()
                .setTitle("active auto-reactions")
                .setDescription(list);

            return message.reply({ embeds: [embed] });
        }

        if (action === "add") {
            const trigger = args[1]?.toLowerCase();
            const emoji = args[2];

            if (!trigger || !emoji) {
                return message.reply("*please provide a trigger word and emoji. usage: `,react add <trigger> <emoji>`*");
            }

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { $set: { [`autoReacts.${trigger}`]: emoji } },
                { upsert: true }
            );

            return message.reply(`*added auto-reaction: when someone says \`${trigger}\`, i'll react with ${emoji}.*`);
        }

        if (action === "remove") {
            const trigger = args[1]?.toLowerCase();

            if (!trigger) {
                return message.reply("*please provide the trigger word to remove. usage: `,react remove <trigger>`*");
            }

            if (!settings?.autoReacts?.has(trigger)) {
                return message.reply(`*no auto-reaction found for \`${trigger}\`.*`);
            }

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { $unset: { [`autoReacts.${trigger}`]: "" } }
            );

            return message.reply(`*removed auto-reaction for \`${trigger}\`.*`);
        }
    },
};
