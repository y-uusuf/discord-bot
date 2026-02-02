const { MessageEmbed, MessageActionRow, MessageSelectMenu, MessageButton } = require("discord.js");
const config = require("../../config.json");

const PERMISSIONS = [
    { label: "View Channel", value: "VIEW_CHANNEL" },
    { label: "Send Messages", value: "SEND_MESSAGES" },
    { label: "Embed Links", value: "EMBED_LINKS" },
    { label: "Attach Files", value: "ATTACH_FILES" },
    { label: "Add Reactions", value: "ADD_REACTIONS" },
    { label: "Use External Emojis", value: "USE_EXTERNAL_EMOJIS" },
    { label: "Mention Everyone", value: "MENTION_EVERYONE" },
    { label: "Manage Messages", value: "MANAGE_MESSAGES" },
    { label: "Read Message History", value: "READ_MESSAGE_HISTORY" },
    { label: "Connect", value: "CONNECT" },
    { label: "Speak", value: "SPEAK" },
    { label: "Mute Members", value: "MUTE_MEMBERS" },
    { label: "Deafen Members", value: "DEAFEN_MEMBERS" },
    { label: "Move Members", value: "MOVE_MEMBERS" },
    { label: "Manage Channels", value: "MANAGE_CHANNELS" },
    { label: "Manage Roles", value: "MANAGE_ROLES" }
];

module.exports = {
    name: "channel",
    aliases: ["ch"],
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_CHANNELS")) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`❌ <@${message.author.id}>: you need **Manage Channels** permission.`);
            return message.reply({ embeds: [embed] });
        }

        const action = args[0]?.toLowerCase();

        if (!action) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`📁 <@${message.author.id}>: manage channels.\n\n**usage:**\n\`,ch create <type> <name>\`\n\`,ch delete <channel>\`\n\`,ch edit <channel>\`\n\n**types:** text, voice, category, stage, forum`);
            return message.reply({ embeds: [embed] });
        }

        // Get target channel (for delete/edit)
        const getChannel = (input) => {
            if (!input) return null;
            return message.mentions.channels.first() ||
                message.guild.channels.cache.get(input.replace(/[<#>]/g, "")) ||
                message.guild.channels.cache.find(c => c.name.toLowerCase() === input.toLowerCase());
        };

        switch (action) {
            case "create": {
                const type = args[1]?.toLowerCase();
                const name = args.slice(2).join(" ");

                if (!type || !name) {
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`❌ <@${message.author.id}>: usage: \`,ch create <type> <name>\``);
                    return message.reply({ embeds: [embed] });
                }

                const typeMap = {
                    text: "GUILD_TEXT",
                    voice: "GUILD_VOICE",
                    category: "GUILD_CATEGORY",
                    stage: "GUILD_STAGE_VOICE",
                    forum: "GUILD_FORUM"
                };

                if (!typeMap[type]) {
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`❌ <@${message.author.id}>: invalid type. use: text, voice, category, stage, forum`);
                    return message.reply({ embeds: [embed] });
                }

                try {
                    const channel = await message.guild.channels.create(name, { type: typeMap[type] });
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`✅ <@${message.author.id}>: created ${type} channel: <#${channel.id}>`);
                    return message.reply({ embeds: [embed] });
                } catch (err) {
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`❌ <@${message.author.id}>: failed to create channel.`);
                    return message.reply({ embeds: [embed] });
                }
            }

            case "delete":
            case "del": {
                const channel = getChannel(args[1]);

                if (!channel) {
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`❌ <@${message.author.id}>: please specify a valid channel.`);
                    return message.reply({ embeds: [embed] });
                }

                try {
                    const channelName = channel.name;
                    await channel.delete();
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`✅ <@${message.author.id}>: deleted channel: **${channelName}**`);
                    return message.reply({ embeds: [embed] });
                } catch (err) {
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`❌ <@${message.author.id}>: failed to delete channel.`);
                    return message.reply({ embeds: [embed] });
                }
            }

            case "edit": {
                const channel = getChannel(args[1]);

                if (!channel) {
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`❌ <@${message.author.id}>: please specify a valid channel.`);
                    return message.reply({ embeds: [embed] });
                }

                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`⚙️ <@${message.author.id}>: editing permissions for <#${channel.id}>\n\nSelect a permission from the dropdown below.`);

                const selectMenu = new MessageSelectMenu()
                    .setCustomId(`ch_perm_select_${channel.id}`)
                    .setPlaceholder("Select a permission...")
                    .addOptions(PERMISSIONS.map(p => ({
                        label: p.label,
                        value: `${channel.id}_${p.value}`
                    })));

                const row = new MessageActionRow().addComponents(selectMenu);

                return message.reply({ embeds: [embed], components: [row] });
            }

            default: {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`❌ <@${message.author.id}>: unknown action. use \`,ch\` for help.`);
                return message.reply({ embeds: [embed] });
            }
        }
    }
};
