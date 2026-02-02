const { Modal, TextInputComponent, MessageActionRow, MessageEmbed, MessageButton } = require("discord.js");
const config = require("../config.json");
const TempVoice = require("../models/tempVoice");

module.exports = {
    name: "interactionCreate",
    async execute(interaction, client) {

        // Handle channel permission select menu
        if (interaction.isSelectMenu() && interaction.customId.startsWith("ch_perm_select_")) {
            if (!interaction.member.permissions.has("MANAGE_CHANNELS")) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`❌ <@${interaction.user.id}>: you need **Manage Channels** permission.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const [channelId, permission] = interaction.values[0].split("_");
            const channel = interaction.guild.channels.cache.get(channelId);

            if (!channel) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`❌ <@${interaction.user.id}>: channel not found.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // Store the selected permission and show Allow/Reset/Deny buttons
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`⚙️ <@${interaction.user.id}>: editing **${permission.replace(/_/g, " ")}** for <#${channel.id}>\n\nSelect an action:`);

            const row = new MessageActionRow().addComponents(
                new MessageButton().setCustomId(`ch_perm_allow_${channelId}_${permission}`).setLabel("Allow").setStyle("SUCCESS"),
                new MessageButton().setCustomId(`ch_perm_reset_${channelId}_${permission}`).setLabel("Reset").setStyle("SECONDARY"),
                new MessageButton().setCustomId(`ch_perm_deny_${channelId}_${permission}`).setLabel("Deny").setStyle("DANGER")
            );

            return interaction.update({ embeds: [embed], components: [row] });
        }

        // Handle channel permission buttons
        if (interaction.isButton() && interaction.customId.startsWith("ch_perm_")) {
            if (!interaction.member.permissions.has("MANAGE_CHANNELS")) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`❌ <@${interaction.user.id}>: you need **Manage Channels** permission.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const parts = interaction.customId.split("_");
            const action = parts[2]; // allow, reset, or deny
            const channelId = parts[3];
            const permission = parts[4];

            const channel = interaction.guild.channels.cache.get(channelId);
            if (!channel) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`❌ <@${interaction.user.id}>: channel not found.`);
                return interaction.update({ embeds: [embed], components: [] });
            }

            try {
                let permValue;
                let actionText;

                switch (action) {
                    case "allow":
                        permValue = true;
                        actionText = "allowed";
                        break;
                    case "deny":
                        permValue = false;
                        actionText = "denied";
                        break;
                    case "reset":
                        permValue = null;
                        actionText = "reset";
                        break;
                }

                await channel.permissionOverwrites.edit(interaction.guild.id, { [permission]: permValue });

                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`✅ <@${interaction.user.id}>: **${permission.replace(/_/g, " ")}** ${actionText} for <#${channel.id}>`);

                return interaction.update({ embeds: [embed], components: [] });
            } catch (err) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`❌ <@${interaction.user.id}>: failed to update permission.`);
                return interaction.update({ embeds: [embed], components: [] });
            }
        }

        // Handle activity confirmation buttons
        if (interaction.isButton() && interaction.customId.startsWith("activity_")) {
            const parts = interaction.customId.split("_");
            const action = parts[1]; // confirm or cancel
            const ownerId = parts[parts.length - 1];

            if (interaction.user.id !== ownerId) {
                return interaction.reply({ content: "This is not for you.", ephemeral: true });
            }

            if (action === "cancel") {
                client.pendingActivity?.delete(interaction.user.id);
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`> ❌ <@${interaction.user.id}>: cancelled.`);
                return interaction.update({ embeds: [embed], components: [] });
            }

            if (action === "confirm") {
                const pending = client.pendingActivity?.get(interaction.user.id);
                if (!pending) {
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`❌ <@${interaction.user.id}>: activity request expired.`);
                    return interaction.update({ embeds: [embed], components: [] });
                }

                client.user.setPresence({
                    activities: [{ name: pending.name, type: "PLAYING" }],
                    status: pending.status
                });

                client.pendingActivity.delete(interaction.user.id);

                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`> ✅ <@${interaction.user.id}>: activity updated.`);
                return interaction.update({ embeds: [embed], components: [] });
            }
        }


        if (!interaction.isButton() && !interaction.isModalSubmit()) return;


        if (interaction.isButton()) {
            if (!interaction.customId.startsWith("vc_")) return;

            const action = interaction.customId.replace("vc_", "");


            if (action === "claim") {
                const currentChannel = interaction.member.voice.channel;
                if (!currentChannel) {
                    const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${interaction.user.id}>: you must be in a voice channel to claim it.`);
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                const tempVoice = await TempVoice.findOne({ channelId: currentChannel.id });
                if (!tempVoice) {
                    const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${interaction.user.id}>: this is not a temporary voice channel.`);
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                if (currentChannel.members.has(tempVoice.ownerId)) {
                    const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${interaction.user.id}>: the owner <@${tempVoice.ownerId}> is still in the channel.`);
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }


                tempVoice.ownerId = interaction.user.id;
                await tempVoice.save();

                await currentChannel.permissionOverwrites.edit(interaction.user.id, {
                    MANAGE_CHANNELS: true,
                    MOVE_MEMBERS: true,
                    CONNECT: true
                });

                const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 👑 <@${interaction.user.id}>: you have claimed this channel.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }


            if (!interaction.member.voice.channel) {
                const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${interaction.user.id}>: you must be in a voice channel to manage it.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const currentChannel = interaction.member.voice.channel;


            const tempVoice = await TempVoice.findOne({ channelId: currentChannel.id });

            if (!tempVoice) {
                const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${interaction.user.id}>: you don't have ownership over <#${currentChannel.id}>.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }


            if (tempVoice.ownerId !== interaction.user.id) {
                const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${interaction.user.id}>: you don't have ownership over <#${currentChannel.id}>.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }


            const channel = currentChannel;




            const sendUserSelect = async (customId, placeholder, emoji) => {
                try {

                    const text = placeholder.toLowerCase();

                    const promptEmbed = new MessageEmbed()
                        .setColor(config.embedColor).setDescription(`> ${emoji} <@${interaction.user.id}>: **${text}.**`)
                        .toJSON();

                    await client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                content: null,
                                embeds: [promptEmbed],
                                components: [{
                                    type: 1,
                                    components: [{
                                        type: 5,
                                        custom_id: customId,
                                        placeholder: text
                                    }]
                                }],
                                flags: 64
                            }
                        }
                    });
                } catch (err) {
                    console.error("Failed to send User Select via API:", err);
                    const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${interaction.user.id}>: error displaying selection menu.`);
                    interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => { });
                }
            };


            switch (action) {
                case "name":
                    const nameModal = new Modal().setCustomId("vc_modal_name").setTitle("Change Channel Name");
                    const nameInput = new TextInputComponent().setCustomId("name_input").setLabel("New Name").setStyle("SHORT");
                    nameModal.addComponents(new MessageActionRow().addComponents(nameInput));
                    await interaction.showModal(nameModal);
                    break;

                case "limit":
                    const limitModal = new Modal().setCustomId("vc_modal_limit").setTitle("Change User Limit");
                    const limitInput = new TextInputComponent().setCustomId("limit_input").setLabel("Limit (0 for unlimited)").setStyle("SHORT");
                    limitModal.addComponents(new MessageActionRow().addComponents(limitInput));
                    await interaction.showModal(limitModal);
                    break;

                case "lock":
                    // Toggle lock state based on current state
                    if (tempVoice.locked) {
                        await channel.permissionOverwrites.edit(interaction.guild.id, { CONNECT: null });
                        tempVoice.locked = false;
                        await tempVoice.save();
                        const unlockEmbed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 🔓 <@${interaction.user.id}>: channel unlocked.`);
                        await interaction.reply({ embeds: [unlockEmbed], ephemeral: true });
                    } else {
                        await channel.permissionOverwrites.edit(interaction.guild.id, { CONNECT: false });
                        tempVoice.locked = true;
                        await tempVoice.save();
                        const lockEmbed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 🔒 <@${interaction.user.id}>: channel locked.`);
                        await interaction.reply({ embeds: [lockEmbed], ephemeral: true });
                    }
                    break;

                case "hide":
                    // Toggle hide state based on current state
                    if (tempVoice.hidden) {
                        await channel.permissionOverwrites.edit(interaction.guild.id, { VIEW_CHANNEL: null });
                        tempVoice.hidden = false;
                        await tempVoice.save();
                        const unhideEmbed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 👀 <@${interaction.user.id}>: channel unhidden.`);
                        await interaction.reply({ embeds: [unhideEmbed], ephemeral: true });
                    } else {
                        await channel.permissionOverwrites.edit(interaction.guild.id, { VIEW_CHANNEL: false });
                        tempVoice.hidden = true;
                        await tempVoice.save();
                        const hideEmbed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 👻 <@${interaction.user.id}>: channel hidden.`);
                        await interaction.reply({ embeds: [hideEmbed], ephemeral: true });
                    }
                    break;

                case "delete":
                    const deleteEmbed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 🗑️ <@${interaction.user.id}>: deleting channel...`);
                    await interaction.reply({ embeds: [deleteEmbed], ephemeral: true });
                    await channel.delete().catch(() => { });
                    await TempVoice.deleteOne({ channelId: channel.id });
                    break;

                case "ban":
                    await sendUserSelect("vc_select_ban", "select user to ban", "🚫");
                    break;
                case "kick":
                    await sendUserSelect("vc_select_kick", "select user to kick", "👢");
                    break;
                case "trust":
                    await sendUserSelect("vc_select_trust", "select user to trust", "➕");
                    break;
                case "transfer":
                    await sendUserSelect("vc_select_transfer", "select new owner", "🔁");
                    break;
                case "untrust":
                    await sendUserSelect("vc_select_untrust", "select user to untrust", "➖");
                    break;
                case "unban":
                    await sendUserSelect("vc_select_unban", "select user to unban", "🕊️");
                    break;

                default:
                    const unknownEmbed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${interaction.user.id}>: unknown action.`);
                    interaction.reply({ embeds: [unknownEmbed], ephemeral: true });
            }
        }


        if (interaction.isModalSubmit()) {
            const tempVoice = await TempVoice.findOne({ ownerId: interaction.user.id });
            if (!tempVoice) return;

            const channel = interaction.guild.channels.cache.get(tempVoice.channelId);
            if (!channel) return;

            const getValue = (id) => interaction.fields.getTextInputValue(id);

            try {
                if (interaction.customId === "vc_modal_name") {
                    const name = getValue("name_input");
                    await channel.setName(name);
                    const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`> ✏️ <@${interaction.user.id}>: renamed to **${name}**.`);
                    interaction.reply({ embeds: [embed], ephemeral: true });
                }
                else if (interaction.customId === "vc_modal_limit") {
                    const limit = parseInt(getValue("limit_input"));
                    if (!isNaN(limit)) {
                        await channel.setUserLimit(limit);
                        tempVoice.limit = limit;
                        await tempVoice.save();
                        const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 👥 <@${interaction.user.id}>: limit set to **${limit}**.`);
                        interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                }
            } catch (e) {
                console.error(e);
                const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${interaction.user.id}>: failed to update settings.`);
                interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    }
};
