const { MessageEmbed } = require("discord.js");
const Settings = require("../../models/settings");

module.exports = {
    name: "set",
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_GUILD")) {
            return message.reply("*sorry, you need 'Manage Server' permission to configure settings.*");
        }

        const type = args[0]?.toLowerCase();
        const value = args[1];

        // Valid setting types
        const validTypes = {
            mute: { field: "muteRole", name: "mute role", isRole: true },
            trialrole: { field: "trialRole", name: "trial role", isRole: true },
            log: { field: "logChannel", name: "log channel", isChannel: true },
            welcome: { field: "welcomeChannel", name: "welcome channel", isChannel: true },
            confess: { field: "confessChannel", name: "confession channel", isChannel: true },
            trial: { field: "trialChannel", name: "trial channel", isChannel: true },
            counting: { field: "countingChannel", name: "counting channel", isChannel: true },
            level: { field: "levelChannel", name: "level channel", isChannel: true },
            prefix: { field: "prefix", name: "bot prefix", isString: true }
        };

        // Show help if no args
        if (!type) {
            const embed = new MessageEmbed()
                .setTitle("server settings")
                .setDescription("*configure server settings stored in the database.*")
                .addFields(
                    { name: "```usage```", value: "`,set <type> <value>`", inline: false },
                    { name: "```roles```", value: "`mute` - mute role\n`trialrole` - trial role", inline: false },
                    { name: "```channels```", value: "`log` - log channel\n`welcome` - welcome channel\n`confess` - confess channel\n`trial` - trial channel\n`counting` - counting channel\n`level` - level up channel", inline: false },
                    { name: "```misc```", value: "`prefix` - bot prefix", inline: false },
                    { name: "```examples```", value: "`,set mute @Muted`\n`,set log #logs`\n`,set prefix !`", inline: false },
                    { name: "```view```", value: "`,set view` - see current settings", inline: false },
                    { name: "```remove```", value: "`,set remove <type>` - remove a setting", inline: false }
                );
            return message.reply({ embeds: [embed] });
        }

        // View current settings
        if (type === "view") {
            const config = await Settings.findOne({ guildId: message.guild.id });
            if (!config) {
                return message.reply("*no settings configured for this server.*");
            }

            const embed = new MessageEmbed()
                .setTitle("current server settings")
                .addFields(
                    { name: "```prefix```", value: config.prefix ? `\`${config.prefix}\`` : "`not set`", inline: true },
                    { name: "```mute role```", value: config.muteRole ? `<@&${config.muteRole}>` : "`not set`", inline: true },
                    { name: "```log channel```", value: config.logChannel ? `<#${config.logChannel}>` : "`not set`", inline: true },
                    { name: "```welcome channel```", value: config.welcomeChannel ? `<#${config.welcomeChannel}>` : "`not set`", inline: true },
                    { name: "```confess channel```", value: config.confessChannel ? `<#${config.confessChannel}>` : "`not set`", inline: true },
                    { name: "```trial channel```", value: config.trialChannel ? `<#${config.trialChannel}>` : "`not set`", inline: true },
                    { name: "```trial role```", value: config.trialRole ? `<@&${config.trialRole}>` : "`not set`", inline: true },
                    { name: "```counting channel```", value: config.countingChannel ? `<#${config.countingChannel}>` : "`not set`", inline: true },
                    { name: "```level channel```", value: config.levelChannel ? `<#${config.levelChannel}>` : "`not set`", inline: true }
                );
            return message.reply({ embeds: [embed] });
        }

        // Remove a setting
        if (type === "remove") {
            const removeType = args[1]?.toLowerCase();

            if (!removeType || !validTypes[removeType]) {
                return message.reply(`*please specify which setting to remove: ${Object.keys(validTypes).join(", ")}*`);
            }

            const setting = validTypes[removeType];
            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { [setting.field]: null },
                { upsert: true }
            );

            return message.reply(`*removed the **${setting.name}** setting.*`);
        }

        // Set a value
        if (!validTypes[type]) {
            return message.reply(`*invalid type. use: ${Object.keys(validTypes).join(", ")}*`);
        }

        if (!value) {
            return message.reply("*please provide a value (role, channel, or text).*");
        }

        const setting = validTypes[type];
        let id;

        if (setting.isString) {
            id = value;
        } else if (setting.isRole) {
            // Parse role mention or ID
            const role = message.mentions.roles.first() || message.guild.roles.cache.get(value.replace(/[<@&>]/g, ""));
            if (!role) {
                return message.reply("*please mention a valid role or provide a role ID.*");
            }
            id = role.id;
        } else if (setting.isChannel) {
            // Parse channel mention or ID
            const channel = message.mentions.channels.first() || message.guild.channels.cache.get(value.replace(/[<#>]/g, ""));
            if (!channel) {
                return message.reply("*please mention a valid channel or provide a channel ID.*");
            }
            id = channel.id;
        }

        await Settings.findOneAndUpdate(
            { guildId: message.guild.id },
            { [setting.field]: id },
            { upsert: true }
        );

        // Enforce privacy immediately if setting trial channel
        if (setting.field === "trialChannel") {
            try {
                const channel = message.guild.channels.cache.get(id);
                if (channel) {
                    await channel.permissionOverwrites.edit(message.guild.id, {
                        VIEW_CHANNEL: false,
                        SEND_MESSAGES: false
                    });
                }
            } catch (e) { }
        }

        const embed = new MessageEmbed()
            .setTitle("setting configured")
            .setDescription(`*the **${setting.name}** has been set to ${setting.isString ? `\`${id}\`` : (setting.isRole ? `<@&${id}>` : `<#${id}>`)}.*`);

        return message.reply({ embeds: [embed] });
    },
};
