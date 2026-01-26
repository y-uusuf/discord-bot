const { MessageEmbed } = require("discord.js");
const Settings = require("../../models/settings");

module.exports = {
    name: "flag",
    description: "Manage flagged words and logging.",
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_GUILD")) {
            return message.reply("*sorry, you need 'Manage Server' permission to manage flagged words.*");
        }

        const sub = args[0]?.toLowerCase();

        if (!sub) {
            const embed = new MessageEmbed()
                .setTitle("flag command")
                .setDescription("*monitor messages for specific words.*")
                .addFields(
                    { name: "```usage```", value: "`,flag <subcommand> <args>`", inline: false },
                    { name: "```subcommands```", value: "`add <word>` - add a flagged word\n`remove <word>` - remove a flagged word\n`list` - list all flagged words\n`ping <@role>` - set role to ping on flag detection\n`ping remove` - disable ping", inline: false },
                    { name: "```examples```", value: "`,flag add scam`\n`,flag list`\n`,flag ping @Mods`", inline: false }
                );
            return message.reply({ embeds: [embed] });
        }

        // --- ADD WORD ---
        if (sub === "add") {
            const word = args.slice(1).join(" ");
            if (!word) return message.reply("*please provide a word to flag.*");

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { $addToSet: { flaggedWords: word } },
                { upsert: true }
            );

            return message.reply(`*successfully added **${word}** to flagged words.*`);
        }

        // --- REMOVE WORD ---
        if (sub === "remove") {
            const word = args.slice(1).join(" ");
            if (!word) return message.reply("*please provide a word to remove.*");

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { $pull: { flaggedWords: word } },
                { upsert: true }
            );

            return message.reply(`*successfully removed **${word}** from flagged words.*`);
        }

        // --- LIST WORDS ---
        if (sub === "list") {
            const settings = await Settings.findOne({ guildId: message.guild.id });
            if (!settings || !settings.flaggedWords || settings.flaggedWords.length === 0) {
                return message.reply("*no flagged words set.*");
            }

            const embed = new MessageEmbed()
                .setTitle("flagged words")
                .setDescription(settings.flaggedWords.map((w, i) => `\`${i + 1}.\` ${w}`).join("\n"))
                .setColor("RED");

            return message.reply({ embeds: [embed] });
        }

        // --- PING ROLE ---
        if (sub === "ping") {
            const roleArg = args[1];

            if (roleArg?.toLowerCase() === "remove") {
                await Settings.findOneAndUpdate(
                    { guildId: message.guild.id },
                    { flagLogPing: null },
                    { upsert: true }
                );
                return message.reply("*flag ping removed.*");
            }

            const role = message.mentions.roles.first() || message.guild.roles.cache.get(roleArg?.replace(/[<@&>]/g, ""));

            if (!role) {
                const settings = await Settings.findOne({ guildId: message.guild.id });
                const currentObj = settings?.flagLogPing ? `<@&${settings.flagLogPing}>` : "`none`";
                return message.reply(`*current flag ping: ${currentObj}. provide a role to set, or use \`remove\`.*`);
            }

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { flagLogPing: role.id },
                { upsert: true }
            );

            return message.reply(`*flag ping set to **${role.name}**.*`);
        }
    }
};
