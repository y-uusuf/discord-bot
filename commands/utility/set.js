const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const Settings = require("../../models/settings");

module.exports = {
    name: "set",
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_GUILD")) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: you are missing **Manage Server** permission(s) to run this command.`);
            return message.reply({ embeds: [embed] });
        }

        const type = args[0]?.toLowerCase();
        const value = args[1];

        const validTypes = {
            mute: { field: "muteRole", name: "mute role", isRole: true },
            trialrole: { field: "trialRole", name: "trial role", isRole: true },
            log: { field: "logChannel", name: "log channel", isChannel: true },
            welcome: { field: "welcomeChannel", name: "welcome channel", isChannel: true },
            confess: { field: "confessChannel", name: "confession channel", isChannel: true },
            trial: { field: "trialChannel", name: "trial channel", isChannel: true },
            counting: { field: "countingChannel", name: "counting channel", isChannel: true },
            level: { field: "levelChannel", name: "level channel", isChannel: true },
            vc: { field: "joinToCreateChannel", name: "vc interface", special: true },
            prefix: { field: "prefix", name: "bot prefix", isString: true }
        };

        // Show help if no args
        if (!type) {
            const embed = new MessageEmbed()
                .setDescription(`⚙️ <@${message.author.id}>: configure server settings.\n\n**usage:** \`,set <type> <value>\`\n**example:** \`,set log #logs\`\n\n**roles:** mute, trialrole\n**channels:** log, welcome, confess, trial, counting, level\n**misc:** prefix, vc\n**other:** \`,set view\` or \`,set remove <type>\``);
            return message.reply({ embeds: [embed] });
        }

        // View current settings
        if (type === "view") {
            const config = await Settings.findOne({ guildId: message.guild.id });
            if (!config) {
                const embed = new MessageEmbed()
                    .setDescription(`⚙️ <@${message.author.id}>: no settings configured for this server.`);
                return message.reply({ embeds: [embed] });
            }

            let info = `⚙️ <@${message.author.id}>: server settings\n\n`;
            info += `**prefix:** ${config.prefix || "not set"}\n`;
            info += `**mute role:** ${config.muteRole ? `<@&${config.muteRole}>` : "not set"}\n`;
            info += `**log channel:** ${config.logChannel ? `<#${config.logChannel}>` : "not set"}\n`;
            info += `**welcome channel:** ${config.welcomeChannel ? `<#${config.welcomeChannel}>` : "not set"}\n`;
            info += `**trial channel:** ${config.trialChannel ? `<#${config.trialChannel}>` : "not set"}\n`;
            info += `**trial role:** ${config.trialRole ? `<@&${config.trialRole}>` : "not set"}.`;

            const embed = new MessageEmbed().setDescription(info);
            return message.reply({ embeds: [embed] });
        }

        // Remove a setting
        if (type === "remove") {
            const removeType = args[1]?.toLowerCase();

            if (!removeType || !validTypes[removeType]) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: please specify which setting to remove: ${Object.keys(validTypes).join(", ")}.`);
                return message.reply({ embeds: [embed] });
            }

            const setting = validTypes[removeType];
            await Settings.findOneAndUpdate(
                { guildId: message.guild.id },
                { [setting.field]: null },
                { upsert: true }
            );

            const embed = new MessageEmbed()
                .setDescription(`⚙️ <@${message.author.id}>: removed the **${setting.name}** setting.`);
            return message.reply({ embeds: [embed] });
        }

        // Set a value
        if (!validTypes[type]) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: invalid type. use: ${Object.keys(validTypes).join(", ")}.`);
            return message.reply({ embeds: [embed] });
        }

        if (!value && !validTypes[type]?.special) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: please provide a value.`);
            return message.reply({ embeds: [embed] });
        }

        const setting = validTypes[type];
        let id;

        // Special handling for VC Interface
        if (setting?.special && type === "vc") {
            // Validate input: must be a TEXT channel
            if (!value) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: please provide a text channel argument.`);
                return message.reply({ embeds: [embed] });
            }

            const targetTextChannel = message.mentions.channels.first() || message.guild.channels.cache.get(value.replace(/[<#>]/g, ""));

            if (!targetTextChannel || !targetTextChannel.isText()) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: please provide a valid **text channel** for the interface.`);
                return message.reply({ embeds: [embed] });
            }

            // Lock Permissions
            try {
                await targetTextChannel.permissionOverwrites.edit(message.guild.id, {
                    SEND_MESSAGES: false,
                    ADD_REACTIONS: false
                });
            } catch (err) {
                console.log("Failed to lock channel perms:", err);
            }

            // Adopt or Create "j2c" Voice Channel
            const category = targetTextChannel.parent;

            try {
                // Find existing channel named "j2c"
                let j2cChannel = message.guild.channels.cache.find(c => c.name === "j2c" && c.type === "GUILD_VOICE");

                if (!j2cChannel) {
                    j2cChannel = await message.guild.channels.create("j2c", {
                        type: "GUILD_VOICE",
                        parent: category ? category.id : null,
                        userLimit: 1
                    });
                } else if (category && j2cChannel.parentId !== category.id) {
                    // Ensure it's in the same category (optional, but good UX)
                    try { await j2cChannel.setParent(category.id); } catch (e) { }
                }

                id = j2cChannel.id; // Save this ID to settings

                // Send Interface Embed to Target Text Channel
                const embed = new MessageEmbed()
                    .setColor("#2b2d31")
                    .setDescription("- this interface can be used to manage temporary voice channels.\n- you can do it also with typing '**,vc**'.\n\n> [✏️]: `change name.`\n> [👥]: `set user limit.`\n> [🔒]: `lock/unlock.`\n> [👻]: `hide/unhide.`\n> [➕]: `trust user.`\n> [➖]: `untrust user.`\n> [🗣️]: `invite user.`\n> [👢]: `kick user.`\n> [🚫]: `ban user.`\n> [🕊️]: `unban user.`\n> [👑]: `claim ownership.`\n> [🔁]: `transfer owner.`\n> [🗑️]: `delete channel.`")
                    .setFooter({ text: "press the buttons below to use the interface." });

                const row1 = new MessageActionRow().addComponents(
                    new MessageButton().setCustomId("vc_name").setEmoji("✏️").setStyle("SECONDARY"),
                    new MessageButton().setCustomId("vc_limit").setEmoji("👥").setStyle("SECONDARY"),
                    new MessageButton().setCustomId("vc_lock").setEmoji("🔒").setStyle("SECONDARY"),
                    new MessageButton().setCustomId("vc_unlock").setEmoji("🔓").setStyle("SECONDARY")
                );

                const row2 = new MessageActionRow().addComponents(
                    new MessageButton().setCustomId("vc_hide").setEmoji("👻").setStyle("SECONDARY"),
                    new MessageButton().setCustomId("vc_unhide").setEmoji("👀").setStyle("SECONDARY"),
                    new MessageButton().setCustomId("vc_trust").setEmoji("➕").setStyle("SECONDARY"),
                    new MessageButton().setCustomId("vc_untrust").setEmoji("➖").setStyle("SECONDARY")
                );

                const row3 = new MessageActionRow().addComponents(
                    new MessageButton().setCustomId("vc_kick").setEmoji("👢").setStyle("SECONDARY"),
                    new MessageButton().setCustomId("vc_ban").setEmoji("🚫").setStyle("SECONDARY"),
                    new MessageButton().setCustomId("vc_unban").setEmoji("🕊️").setStyle("SECONDARY"),
                    new MessageButton().setCustomId("vc_claim").setEmoji("👑").setStyle("SECONDARY")
                );

                const row4 = new MessageActionRow().addComponents(
                    new MessageButton().setCustomId("vc_transfer").setEmoji("🔁").setStyle("SECONDARY"),
                    new MessageButton().setCustomId("vc_delete").setEmoji("🗑️").setStyle("DANGER")
                );

                await targetTextChannel.send({ embeds: [embed], components: [row1, row2, row3, row4] });

            } catch (error) {
                console.error(error);
                return message.reply("*failed to create/adopt channels or send interface.*");
            }
        } else if (setting.isString) {
            id = value;
        } else if (setting.isRole) {
            const role = message.mentions.roles.first() || message.guild.roles.cache.get(value.replace(/[<@&>]/g, ""));
            if (!role) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: please mention a valid role or provide a role ID.`);
                return message.reply({ embeds: [embed] });
            }
            id = role.id;
        } else if (setting.isChannel) {
            const channel = message.mentions.channels.first() || message.guild.channels.cache.get(value.replace(/[<#>]/g, ""));
            if (!channel) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: please mention a valid channel or provide a channel ID.`);
                return message.reply({ embeds: [embed] });
            }
            id = channel.id;
        }

        await Settings.findOneAndUpdate(
            { guildId: message.guild.id },
            { [setting.field]: id },
            { upsert: true }
        );

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

        if (setting.special) return;

        const embed = new MessageEmbed()
            .setDescription(`⚙️ <@${message.author.id}>: set **${setting.name}** to ${setting.isString ? `\`${id}\`` : (setting.isRole ? `<@&${id}>` : `<#${id}>`)}.`);
        return message.reply({ embeds: [embed] });
    },
};
