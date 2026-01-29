const { Modal, TextInputComponent, MessageActionRow, MessageEmbed, MessageButton } = require("discord.js");
const TempVoice = require("../models/tempVoice");

module.exports = {
    name: "interactionCreate",
    async execute(interaction, client) {
        // We handle Buttons and Modals here.
        // User Select Menus (Type 5) are handled in 'events/raw.js'.
        if (!interaction.isButton() && !interaction.isModalSubmit()) return;

        // --- BUTTON HANDLING ---
        if (interaction.isButton()) {
            if (!interaction.customId.startsWith("vc_")) return;

            const action = interaction.customId.replace("vc_", "");

            // 1. Claim Logic (Kept separate)
            if (action === "claim") {
                const currentChannel = interaction.member.voice.channel;
                if (!currentChannel) {
                    const embed = new MessageEmbed().setDescription(`❌ <@${interaction.user.id}>: you must be in a voice channel to claim it.`);
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                const tempVoice = await TempVoice.findOne({ channelId: currentChannel.id });
                if (!tempVoice) {
                    const embed = new MessageEmbed().setDescription(`❌ <@${interaction.user.id}>: this is not a temporary voice channel.`);
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                if (currentChannel.members.has(tempVoice.ownerId)) {
                    const embed = new MessageEmbed().setDescription(`❌ <@${interaction.user.id}>: the owner <@${tempVoice.ownerId}> is still in the channel.`);
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                // Claim it
                tempVoice.ownerId = interaction.user.id;
                await tempVoice.save();

                await currentChannel.permissionOverwrites.edit(interaction.user.id, {
                    MANAGE_CHANNELS: true,
                    MOVE_MEMBERS: true,
                    CONNECT: true
                });

                const embed = new MessageEmbed().setDescription(`> 👑 <@${interaction.user.id}>: you have claimed this channel.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // --- STRICT CHECKS ---
            if (!interaction.member.voice.channel) {
                const embed = new MessageEmbed().setDescription(`❌ <@${interaction.user.id}>: you must be in a voice channel to manage it.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const currentChannel = interaction.member.voice.channel;

            // 2. Check if Current Channel is a Temp Channel
            const tempVoice = await TempVoice.findOne({ channelId: currentChannel.id });

            if (!tempVoice) {
                const embed = new MessageEmbed().setDescription(`❌ <@${interaction.user.id}>: you don't have ownership over <#${currentChannel.id}>.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // 3. User must be the Owner
            if (tempVoice.ownerId !== interaction.user.id) {
                const embed = new MessageEmbed().setDescription(`❌ <@${interaction.user.id}>: you don't have ownership over <#${currentChannel.id}>.`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // 4. Success
            const channel = currentChannel;


            // Helper to send "User Select Menu" (Type 5) via client.api
            // Includes formatted Embed: "> emoji user: text" (lowercase)
            const sendUserSelect = async (customId, placeholder, emoji) => {
                try {
                    // Force lowercase for aesthetic
                    const text = placeholder.toLowerCase();

                    const promptEmbed = new MessageEmbed()
                        .setDescription(`> ${emoji} <@${interaction.user.id}>: **${text}.**`)
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
                    const embed = new MessageEmbed().setDescription(`❌ <@${interaction.user.id}>: error displaying selection menu.`);
                    interaction.followUp({ embeds: [embed], ephemeral: true }).catch(() => { });
                }
            };

            // Switch Actions
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
                    await channel.permissionOverwrites.edit(interaction.guild.id, { CONNECT: false });
                    tempVoice.locked = true;
                    await tempVoice.save();
                    const lockEmbed = new MessageEmbed().setDescription(`> 🔒 <@${interaction.user.id}>: channel locked.`);
                    await interaction.reply({ embeds: [lockEmbed], ephemeral: true });
                    break;

                case "unlock":
                    await channel.permissionOverwrites.edit(interaction.guild.id, { CONNECT: null });
                    tempVoice.locked = false;
                    await tempVoice.save();
                    const unlockEmbed = new MessageEmbed().setDescription(`> 🔓 <@${interaction.user.id}>: channel unlocked.`);
                    await interaction.reply({ embeds: [unlockEmbed], ephemeral: true });
                    break;

                case "hide":
                    await channel.permissionOverwrites.edit(interaction.guild.id, { VIEW_CHANNEL: false });
                    tempVoice.hidden = true;
                    await tempVoice.save();
                    const hideEmbed = new MessageEmbed().setDescription(`> 👻 <@${interaction.user.id}>: channel hidden.`);
                    await interaction.reply({ embeds: [hideEmbed], ephemeral: true });
                    break;

                case "unhide":
                    await channel.permissionOverwrites.edit(interaction.guild.id, { VIEW_CHANNEL: null });
                    tempVoice.hidden = false;
                    await tempVoice.save();
                    const unhideEmbed = new MessageEmbed().setDescription(`> 👀 <@${interaction.user.id}>: channel unhidden.`);
                    await interaction.reply({ embeds: [unhideEmbed], ephemeral: true });
                    break;

                case "delete":
                    const deleteEmbed = new MessageEmbed().setDescription(`> 🗑️ <@${interaction.user.id}>: deleting channel...`);
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
                    const unknownEmbed = new MessageEmbed().setDescription(`❌ <@${interaction.user.id}>: unknown action.`);
                    interaction.reply({ embeds: [unknownEmbed], ephemeral: true });
            }
        }

        // --- MODAL SUBMIT HANDLING ---
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
                    const embed = new MessageEmbed().setDescription(`> ✏️ <@${interaction.user.id}>: renamed to **${name}**.`);
                    interaction.reply({ embeds: [embed], ephemeral: true });
                }
                else if (interaction.customId === "vc_modal_limit") {
                    const limit = parseInt(getValue("limit_input"));
                    if (!isNaN(limit)) {
                        await channel.setUserLimit(limit);
                        tempVoice.limit = limit;
                        await tempVoice.save();
                        const embed = new MessageEmbed().setDescription(`> 👥 <@${interaction.user.id}>: limit set to **${limit}**.`);
                        interaction.reply({ embeds: [embed], ephemeral: true });
                    }
                }
            } catch (e) {
                console.error(e);
                const embed = new MessageEmbed().setDescription(`❌ <@${interaction.user.id}>: failed to update settings.`);
                interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }
    }
};
