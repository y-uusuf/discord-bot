const { MessageEmbed } = require("discord.js");
const Settings = require("../../models/settings");

module.exports = {
    name: "flag",
    description: "Manage flagged words and logging.",
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_GUILD")) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: you are missing **Manage Server** permission(s) to run this command`);
            return message.reply({ embeds: [embed] });
        }

        const sub = args[0]?.toLowerCase();

        if (!sub) {
            const embed = new MessageEmbed()
                .setDescription(`🚩 <@${message.author.id}>: monitor messages for specific words.\n\n**subcommands:**\n\`add <word>\` - add a flagged word\n\`remove <word>\` - remove a flagged word\n\`list\` - list all flagged words\n\`ping <@role>\` - set role to ping\n\`ping remove\` - disable ping`);
            return message.reply({ embeds: [embed] });
        }

        // --- ADD WORD ---
        if (sub === "add") {
            const word = args.slice(1).join(" ");
            if (!word) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: please provide a word to flag`);
                return message.reply({ embeds: [embed] });
            }

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { $addToSet: { flaggedWords: word } },
                { upsert: true }
            );

            const embed = new MessageEmbed()
                .setDescription(`🚩 <@${message.author.id}>: added **${word}** to flagged words`);
            return message.reply({ embeds: [embed] });
        }

        // --- REMOVE WORD ---
        if (sub === "remove") {
            const word = args.slice(1).join(" ");
            if (!word) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: please provide a word to remove`);
                return message.reply({ embeds: [embed] });
            }

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { $pull: { flaggedWords: word } },
                { upsert: true }
            );

            const embed = new MessageEmbed()
                .setDescription(`🚩 <@${message.author.id}>: removed **${word}** from flagged words`);
            return message.reply({ embeds: [embed] });
        }

        // --- LIST WORDS ---
        if (sub === "list") {
            const settings = await Settings.findOne({ guildId: message.guild.id });
            if (!settings || !settings.flaggedWords || settings.flaggedWords.length === 0) {
                const embed = new MessageEmbed()
                    .setDescription(`📋 <@${message.author.id}>: no flagged words set`);
                return message.reply({ embeds: [embed] });
            }

            const embed = new MessageEmbed()
                .setDescription(`📋 <@${message.author.id}>: flagged words\n\n${settings.flaggedWords.map((w, i) => `**${i + 1}.** ${w}`).join("\n")}`);

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
                const embed = new MessageEmbed()
                    .setDescription(`🚩 <@${message.author.id}>: flag ping removed`);
                return message.reply({ embeds: [embed] });
            }

            const role = message.mentions.roles.first() || message.guild.roles.cache.get(roleArg?.replace(/[<@&>]/g, ""));

            if (!role) {
                const settings = await Settings.findOne({ guildId: message.guild.id });
                const currentObj = settings?.flagLogPing ? `<@&${settings.flagLogPing}>` : "none";
                const embed = new MessageEmbed()
                    .setDescription(`🚩 <@${message.author.id}>: current flag ping: ${currentObj}. provide a role to set, or use \`remove\``);
                return message.reply({ embeds: [embed] });
            }

            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { flagLogPing: role.id },
                { upsert: true }
            );

            const embed = new MessageEmbed()
                .setDescription(`🚩 <@${message.author.id}>: flag ping set to **${role.name}**`);
            return message.reply({ embeds: [embed] });
        }
    }
};
